import { ai } from "@workspace/integrations-gemini-ai";
import { db } from "@workspace/db";
import { noticiasTable } from "@workspace/db";
import { and, desc, eq, sql as sqlRaw } from "drizzle-orm";
import * as cheerio from "cheerio";
import { logger } from "./lib/logger";
import * as fs from "fs";
import * as path from "path";
import { PROMPT_MAESTRO } from "./lib/prompt-maestro";
import { limpiarNota } from "./lib/limpiar-asteriscos";
import { enviarNotaAMake } from "./lib/enviar-a-make";
import { promocionarNotaEnCanal } from "./lib/promocionar-nota";
import { urlImagenSegura } from "./lib/url-imagen-segura";
import { leerEstadoApp, guardarEstadoApp } from "./lib/app-estado";
import { PROMPT_SELECCION } from "./lib/prompt-seleccion";
import { traducirYGuardarHebreo } from "./lib/traductor-hebreo";
import { createEditToken, createLongEditToken, descripcionTtlEdicion, purgeExpiredEditTokens, purgeExpiredSessions } from "./lib/edit-tokens";
import { credencialesTelegram } from "./lib/telegram-cred";
import { leerRedactorSettings, guardarRedactorSettings } from "./lib/redactor-settings";
import {
  listarPendientesHebreo,
  listarPendientesPostulaciones,
  listarPendientesBorradoresEs,
} from "./lib/resumen-pendientes";
import { ObjectStorageService } from "./lib/objectStorage";

export type Categoria = "river" | "seleccion";

// Fuentes en orden de prioridad — La Página Millonaria, sitio oficial y Olé primero
const FUENTES = [
  "pagina", "cariverplate", "ole", "tyc",
  "google", "infobae", "clarin", "lanacion",
  "bolavip", "as", "superdeportivo"
] as const;

// Selección usa las mismas fuentes que River; el endpoint /noticias-seleccion
// aplica el filtro de Argentina (esNoticiaDeSeleccion) sobre cada una.
// Se excluyen "pagina" y "cariverplate" por ser sitios exclusivos de River.
const FUENTES_SELECCION = [
  "ole", "tyc", "google",
  "infobae", "clarin", "lanacion",
  "bolavip", "as", "superdeportivo",
] as const;

// ─── ESTADO PERSISTENTE ───────────────────────────────────────────────────────

const STATE_FILE = path.resolve("./scheduler_state.json");

interface SchedulerState {
  fuenteIndex: number;
  fuenteIndexSel: number;
  categoriaFlip: number; // alterna 0/1 entre river y seleccion en cada ciclo automático
  urlsProcesadas: string[];  // URLs ya enviadas a Telegram (cap 1000)
}

const ESTADO_CLAVE = "scheduler_state";

function normalizarEstado(raw: Partial<SchedulerState> | null): SchedulerState {
  return {
    fuenteIndex:    typeof raw?.fuenteIndex === "number" ? raw.fuenteIndex : 0,
    fuenteIndexSel: typeof raw?.fuenteIndexSel === "number" ? raw.fuenteIndexSel : 0,
    categoriaFlip:  typeof raw?.categoriaFlip === "number" ? raw.categoriaFlip : 0,
    urlsProcesadas: Array.isArray(raw?.urlsProcesadas) ? raw.urlsProcesadas : [],
  };
}

// El estado vive en la DB (tabla app_estado) para sobrevivir reinicios del
// server en producción. Antes se guardaba en scheduler_state.json, que se
// perdía en cada reinicio: la rotación de fuentes arrancaba siempre en la
// primera fuente y el dedupe descartaba todo → nunca se publicaba nada.
async function leerEstado(): Promise<SchedulerState> {
  const desdeDb = await leerEstadoApp<Partial<SchedulerState>>(ESTADO_CLAVE);
  if (desdeDb) return normalizarEstado(desdeDb);
  // Migración: si existe el archivo local viejo, usarlo una vez
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) as Partial<SchedulerState>;
    return normalizarEstado(raw);
  } catch {
    return normalizarEstado(null);
  }
}

async function guardarEstado(estado: SchedulerState): Promise<void> {
  // Cap en 1000 URLs para no crecer indefinidamente
  if (estado.urlsProcesadas.length > 1000) {
    estado.urlsProcesadas = estado.urlsProcesadas.slice(-1000);
  }
  await guardarEstadoApp(ESTADO_CLAVE, estado);
}

// ─── DEDUPLICACIÓN POR URL ────────────────────────────────────────────────────
// Normaliza la URL antes de comparar/guardar: sin hash, sin parámetros de
// tracking (utm_*, fbclid, etc.) y sin barra final. Así la misma nota con
// distintos parámetros no se procesa dos veces.
function normalizarUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    const paramsABorrar: string[] = [];
    u.searchParams.forEach((_v, k) => {
      const key = k.toLowerCase();
      if (key.startsWith("utm_") || ["fbclid", "gclid", "ref", "src", "s", "ncid", "cmpid", "outputtype"].includes(key)) {
        paramsABorrar.push(k);
      }
    });
    for (const k of paramsABorrar) u.searchParams.delete(k);
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

// Chequeo permanente en DB: ¿ya existe una noticia con esta URL canónica?
// Sin ventana de tiempo ni tope de memoria — nunca se repite una URL publicada.
async function urlYaEnDB(url: string): Promise<boolean> {
  const normalizada = normalizarUrl(url);
  if (!normalizada) return false;
  try {
    const res = await db.execute(
      sqlRaw`SELECT 1 FROM noticias WHERE url_fuente = ${normalizada} LIMIT 1`
    );
    return res.rows.length > 0;
  } catch (err) {
    logger.error({ err }, "Scheduler: error consultando url_fuente en DB");
    return false;
  }
}

function urlYaProcesada(url: string, estado: SchedulerState): boolean {
  if (!url) return false;
  const normalizada = normalizarUrl(url);
  return estado.urlsProcesadas.some((u) => normalizarUrl(u) === normalizada);
}

function marcarUrlProcesada(url: string, estado: SchedulerState): void {
  if (!url) return;
  const normalizada = normalizarUrl(url);
  if (estado.urlsProcesadas.some((u) => normalizarUrl(u) === normalizada)) return;
  estado.urlsProcesadas.push(normalizada);
}

// ─── FILTROS DE ACTUALIDAD Y URL ───────────────────────────────────────────────
// Muchos sitios incluyen la fecha en la URL: /2026/04/07/ o -2026-04-07-.
// La fecha también sirve como respaldo cuando el HTML no expone datePublished.
function extraerFechaDeUrl(url: string): Date | null {
  if (!url) return null;
  const m = url.match(/[\/\-](20\d{2})[\/\-](\d{2})[\/\-](\d{2})(?:[\/\-]|$)/);
  if (!m) return null;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia, 12));
  return fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
    ? fecha
    : null;
}

// Excluye páginas de autor, etiquetas, búsquedas y secciones: no son artículos
// aunque algunos scrapers las devuelvan con un título periodístico.
function pareceUrlDeArticulo(url: string): boolean {
  if (!url) return false;
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return !/(^|\/)(autor|author|tag|tags|tema|category|categoria|seccion|search|buscar)(\/|$)/.test(pathname);
  } catch {
    return false;
  }
}

// Si detectamos fecha en la URL y es ≥ 3 días, la descartamos incluso antes
// de descargar el artículo. La autopublicación aplica luego un límite más duro.
function urlDemaisiadoVieja(url: string): boolean {
  const fechaArticulo = extraerFechaDeUrl(url);
  if (!fechaArticulo) return false;
  const diasAtras = (Date.now() - fechaArticulo.getTime()) / (1000 * 60 * 60 * 24);
  return diasAtras >= 3;
}

// ─── DEDUPLICACIÓN POR DB ─────────────────────────────────────────────────────
// Compara el título candidato (scrapeado) con las noticias de los últimos 30 días,
// tanto contra el título publicado (reescrito por la IA) como contra el título
// original scrapeado (primera línea de texto_original). Esto evita repetidos
// aunque la IA haya reescrito el título con otras palabras.
// Umbral estricto: 2 palabras distintivas coincidentes (sin contar genéricas
// como "river" o "argentina") → se considera el mismo tema y se salta.

// Palabras que aparecen en casi todos los títulos y no distinguen una nota de
// otra — no cuentan para el umbral de coincidencias.
const PALABRAS_GENERICAS = new Set([
  "river", "plate", "millonario", "millonarios", "nunez", "monumental",
  "seleccion", "argentina", "argentino", "argentinos", "scaloneta", "mundial",
  "futbol", "partido", "equipo", "jugador", "jugadores", "tecnico", "entrenador",
]);

function palabrasSignificativas(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter(p => p.length >= 5 && !PALABRAS_GENERICAS.has(p));
}

async function tituloYaProcesado(titulo: string): Promise<boolean> {
  try {
    const res = await db.execute(sqlRaw`
      SELECT titulo, texto_original FROM noticias
      WHERE created_at > NOW() - INTERVAL '30 days'
    `);

    const palabras = palabrasSignificativas(titulo);
    // Con menos de 2 palabras distintivas no se puede comparar con confianza;
    // en ese caso la deduplicación por URL sigue actuando.
    if (palabras.length < 2) return false;
    // Umbral estricto: 2 palabras distintivas coincidentes (las genéricas como
    // "river" o "argentina" no cuentan) → mismo tema → no repetir.
    const umbral = 2;

    for (const row of res.rows as { titulo: string; texto_original: string | null }[]) {
      // Título original scrapeado = primera línea de texto_original
      const tituloOriginal = (row.texto_original ?? "").split("\n")[0] ?? "";
      const textosExistentes = [row.titulo, tituloOriginal].filter(Boolean);

      for (const textoExistente of textosExistentes) {
        const existente = textoExistente
          .toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z\s]/g, "");
        // Comparación por raíz (primeros 6 caracteres) para atrapar variaciones
        // de la misma palabra: "convocado" / "convocatoria", "goleada" / "goleó".
        const coincidencias = palabras.filter(p => existente.includes(p.slice(0, 6)));
        if (coincidencias.length >= umbral) {
          logger.info({ candidato: titulo, existente: textoExistente, coincidencias, umbral }, "Scheduler: tema repetido, saltando");
          return true;
        }
      }
    }
    return false;
  } catch (err) {
    logger.warn({ err }, "Scheduler: error en deduplicación por DB, procesando igual");
    return false;
  }
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function parsearResultado(texto: string): { titulo: string; contenido: string; tags: string } {
  const lines = texto.split("\n");

  // ── Extraer título ─────────────────────────────────────────────────────────
  let titulo = "Sin título";
  let tituloLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    // Formato explícito: **Título:** texto
    const m = l.match(/^\*\*Título:\*\*\s*(.+)$/);
    if (m) { titulo = m[1].trim(); tituloLineIdx = i; break; }
    // Formato explícito multi-línea: línea siguiente al marcador
    if (/^\*\*Título:\*\*\s*$/.test(l) && lines[i + 1]) {
      titulo = lines[i + 1].trim().replace(/^\*\*|\*\*$/g, "");
      tituloLineIdx = i; break;
    }
  }
  // Fallback: primera línea en negrita standalone
  if (tituloLineIdx === -1) {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].trim().match(/^\*\*([^*]+)\*\*$/);
      if (m) { titulo = m[1].trim(); tituloLineIdx = i; break; }
    }
  }

  // Guardarraíl: nunca dejar el título "firmado" por el medio de origen
  // (ej: "River ganó - Olé"). La nota se presenta como redacción propia.
  titulo = titulo
    .replace(/\s+[-–—|]\s+(Olé|Ole|TyC Sports|Clarín|Clarin|La Nación|La Nacion|Infobae|ESPN|DeporTV|LA17|Doble Amarilla|cariverplate\.com\.ar|riverplate\.com)\s*$/i, "")
    .trim();

  // ── Extraer bajada ─────────────────────────────────────────────────────────
  let bajada = "";
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    const m = l.match(/^\*\*Bajada:\*\*\s*(.+)$/);
    if (m) { bajada = m[1].trim(); break; }
    if (/^\*\*Bajada:\*\*\s*$/.test(l) && lines[i + 1]) {
      bajada = lines[i + 1].trim(); break;
    }
  }

  // ── Extraer tags ───────────────────────────────────────────────────────────
  let tags = "#RiverPlate #RiverIsrael #RamatGan #ElMasGrande";
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim();
    const m = l.match(/^\*\*Tags:\*\*\s*(.+)$/);
    if (m) { tags = m[1].trim(); break; }
    // Línea suelta de hashtags al final
    if (/^#River/.test(l) && l.includes("#")) { tags = l; break; }
  }

  // ── Construir contenido: todo excepto las líneas de metadatos ──────────────
  // Marcamos las líneas que son headers de parseo y las eliminamos
  const headerPatterns = [
    /^\*\*Título:\*\*/, /^\*\*Bajada:\*\*/, /^\*\*Contenido:\*\*/, /^\*\*Tags:\*\*/,
  ];
  const bodyLines = lines.filter((l, idx) => {
    const trimmed = l.trim();
    // Eliminar líneas de header
    if (headerPatterns.some(p => p.test(trimmed))) return false;
    // Eliminar la línea del título si vino de fallback de negrita
    if (idx === tituloLineIdx) return false;
    // Eliminar la línea que es exactamente la bajada (para no duplicarla)
    if (bajada && trimmed === bajada) return false;
    // Eliminar líneas que son solo hashtags al final
    if (/^#River/.test(trimmed) && trimmed === tags) return false;
    return true;
  });

  let contenido = bodyLines.join("\n").trim();

  // Si la bajada es valiosa, la prepend como primer párrafo
  if (bajada) {
    contenido = `${bajada}\n\n${contenido}`;
  }

  return limpiarNota({ titulo, contenido, tags });
}

// ─── LIMPIEZA DE TEXTO ────────────────────────────────────────────────────────
// Elimina caracteres raros, HTML entities y basura tipográfica del texto scrapeado.

function limpiarTexto(texto: string): string {
  return texto
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8230;/g, "…")
    .replace(/\u00a0/g, " ")      // non-breaking space
    .replace(/\r\n|\r/g, "\n")    // normalizar saltos de línea
    .replace(/\n{3,}/g, "\n\n")   // máximo 2 saltos seguidos
    .replace(/[ \t]{2,}/g, " ")   // múltiples espacios a uno
    .trim();
}

interface TextoArticulo {
  texto: string;
  fechaPublicacion: Date | null;
  imagenUrl: string | null;
  esArticulo: boolean;
}

function resolverUrlDocumento(raw: unknown, base: string): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return new URL(raw, base).toString();
  } catch {
    return null;
  }
}

function fechaValida(raw: unknown): Date | null {
  if (typeof raw !== "string") return null;
  const fecha = new Date(raw);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

async function obtenerTextoArticulo(url: string): Promise<TextoArticulo> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { texto: "", fechaPublicacion: null, imagenUrl: null, esArticulo: false };
    const html = await res.text();
    const $ = cheerio.load(html);

    const urlFinal = res.url || url;
    const canonical = resolverUrlDocumento(
      $('link[rel="canonical"]').attr("href") ??
        $('meta[property="og:url"]').attr("content"),
      urlFinal,
    );
    const urlPagina = canonical ?? urlFinal;
    const paginaCoincideConRespuesta =
      normalizarUrl(urlPagina) === normalizarUrl(urlFinal);
    const tipoOg = ($('meta[property="og:type"]').attr("content") ?? "").toLowerCase();

    // Reunir únicamente nodos Article/NewsArticle. Luego exigimos que su URL
    // corresponda al documento canónico solicitado, no a una tarjeta/listado.
    const nodosArticulo: Record<string, unknown>[] = [];
    const buscarNodosArticulo = (value: unknown): void => {
      if (value === null || typeof value !== "object") return;
      if (Array.isArray(value)) {
        for (const item of value) buscarNodosArticulo(item);
        return;
      }
      const obj = value as Record<string, unknown>;
      const tipo = obj["@type"];
      const tipos = Array.isArray(tipo) ? tipo : [tipo];
      if (tipos.some((t) => typeof t === "string" && /^(news)?article$/i.test(t))) {
        nodosArticulo.push(obj);
      }
      for (const child of Object.values(obj)) buscarNodosArticulo(child);
    };
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        buscarNodosArticulo(JSON.parse($(el).text()) as unknown);
      } catch { /* skip */ }
    });

    const urlsDeNodo = (nodo: Record<string, unknown>): string[] => {
      const main = nodo["mainEntityOfPage"];
      const candidatos: unknown[] = [
        nodo["url"],
        nodo["@id"],
        typeof main === "object" && main !== null
          ? (main as Record<string, unknown>)["@id"] ?? (main as Record<string, unknown>)["url"]
          : main,
      ];
      return candidatos
        .map((valor) => resolverUrlDocumento(valor, urlPagina))
        .filter((valor): valor is string => Boolean(valor));
    };

    let nodoArticulo = nodosArticulo.find((nodo) =>
      urlsDeNodo(nodo).some((urlNodo) => normalizarUrl(urlNodo) === normalizarUrl(urlPagina)),
    );
    // Algunos medios omiten url/mainEntityOfPage en su único NewsArticle.
    // Solo lo aceptamos cuando el propio documento declara og:type=article.
    if (!nodoArticulo && nodosArticulo.length === 1 && tipoOg === "article") {
      nodoArticulo = nodosArticulo[0];
    }

    const esArticulo =
      paginaCoincideConRespuesta &&
      (Boolean(nodoArticulo) || tipoOg === "article");

    // La fecha debe pertenecer al nodo Article que coincide con la URL. Si no
    // hay JSON-LD, aceptamos metadata/tiempo solo en una página og:type=article.
    let fechaPublicacion = nodoArticulo
      ? fechaValida(nodoArticulo["datePublished"])
      : null;
    if (!fechaPublicacion && esArticulo && tipoOg === "article") {
      fechaPublicacion = fechaValida(
        $('meta[property="article:published_time"]').attr("content") ??
          $('meta[name="article:published_time"]').attr("content") ??
          $("article time[datetime]").first().attr("datetime"),
      );
    }

    // Extraer imagen principal del artículo
    const imagenUrl =
      $('meta[property="og:image"]').attr("content") ??
      $('meta[name="twitter:image"]').attr("content") ??
      $('meta[property="og:image:url"]').attr("content") ??
      $('meta[name="og:image"]').attr("content") ??
      null;

    // Primero usamos articleBody del nodo canónico. Si no existe, extraemos
    // párrafos solo de contenedores de contenido del artículo confirmado.
    const articleBodyLd = nodoArticulo && typeof nodoArticulo["articleBody"] === "string"
      ? limpiarTexto(nodoArticulo["articleBody"])
      : "";
    const SELECTORES = [
      "article p",
      ".article-body p",
      ".nota-body p",
      ".article__content p",
      ".post-content p",
      ".detail-body p",
      ".entry-content p",
      "#wrappertext p",        // cariverplate.com.ar
      ".desarrollada p",       // cariverplate.com.ar (fallback)
    ].join(", ");

    let parrafos: string[] = esArticulo
      ? $(SELECTORES)
          .map((_idx, el) => limpiarTexto($(el).text().trim()))
          .get()
          .filter((t: string) => t.length > 50)
      : [];

    // Fallback solo para extracción manual. No convierte por sí mismo una
    // portada/sección en artículo: esArticulo conserva la evidencia positiva.
    if (parrafos.length === 0) {
      parrafos = $("p")
        .map((_idx, el) => limpiarTexto($(el).text().trim()))
        .get()
        .filter((t: string) => t.length > 80);
    }

    const texto = articleBodyLd.length > 200
      ? articleBodyLd
      : parrafos.slice(0, 20).join("\n\n");
    return {
      texto: texto.length > 200 ? texto : "",
      fechaPublicacion,
      imagenUrl,
      esArticulo,
    };
  } catch {
    return { texto: "", fechaPublicacion: null, imagenUrl: null, esArticulo: false };
  }
}

// ─── TIPO DE RESULTADO DEL CICLO ──────────────────────────────────────────────
export type EjecucionResultado =
  | { tipo: "concurrente" }
  | { tipo: "scraping_fallido"; fuente: string }
  | { tipo: "sin_noticias"; fuente: string }
  | { tipo: "todas_procesadas"; fuente: string }
  | { tipo: "ia_sin_contenido" }
 | { tipo: "sin_portada"; fuente: string }
  | { tipo: "telegram_error"; fuente: string }
  | { tipo: "ok"; titulo: string; id: number; fuente: string }
  | { tipo: "error"; mensaje: string };

// ─── PORTADA GARANTIZADA ──────────────────────────────────────────────────────
// Toda nota publicada debe tener foto de portada:
// 1. Se descarga la imagen scrapeada del artículo y se guarda en object storage
//    (URL /objects/... que el frontend ya sabe resolver).
// 2. Si no hay imagen o falla la descarga, se usa una foto de respaldo de la
//    galería del sitio (estáticas en /images/galeria/).
const PORTADAS_FALLBACK = Array.from({ length: 12 }, (_, i) =>
  `/images/galeria/foto-${String(i + 1).padStart(2, "0")}.jpeg`,
);

function portadaFallback(): string {
  return PORTADAS_FALLBACK[Math.floor(Math.random() * PORTADAS_FALLBACK.length)];
}

const EXT_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

// Protección SSRF compartida (ver lib/url-imagen-segura.ts)

async function guardarPortadaEnStorage(imagenUrl: string): Promise<string | null> {
  if (!urlImagenSegura(imagenUrl)) {
    logger.warn({ imagenUrl }, "Scheduler: URL de imagen rechazada por seguridad");
    return null;
  }
  try {
    const res = await fetch(imagenUrl, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const ext = EXT_POR_MIME[contentType];
    if (!ext) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    // Sanidad: entre 1KB y 15MB
    if (buffer.length < 1024 || buffer.length > 15 * 1024 * 1024) return null;
    const storage = new ObjectStorageService();
    const subPath = `portadas/portada-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    return await storage.uploadBuffer(subPath, buffer, contentType);
  } catch (err) {
    logger.warn({ err, imagenUrl }, "Scheduler: no se pudo guardar la portada en storage");
    return null;
  }
}

// ─── FLAG ANTI-CONCURRENCIA ───────────────────────────────────────────────────
let enEjecucion = false;

async function ejecutarCiclo(fuenteOverride?: string, esAutomatico = false, categoriaOverride?: Categoria): Promise<EjecucionResultado> {
  if (enEjecucion) {
    logger.warn("Scheduler: ciclo anterior aún en ejecución, saltando este turno");
    return { tipo: "concurrente" };
  }
  enEjecucion = true;

  try {
    const estado = await leerEstado();

    // Elegir categoría: override > alternancia automática
    let categoria: Categoria;
    if (categoriaOverride) {
      categoria = categoriaOverride;
    } else if (esAutomatico) {
      categoria = estado.categoriaFlip % 2 === 0 ? "river" : "seleccion";
      estado.categoriaFlip += 1;
    } else {
      categoria = "river";
    }

    const fuentesList = categoria === "seleccion" ? FUENTES_SELECCION : FUENTES;
    const indexKey = categoria === "seleccion" ? "fuenteIndexSel" : "fuenteIndex";
    const indiceInicial = estado[indexKey] % fuentesList.length;

    const port = process.env.PORT;
    const endpoint = categoria === "seleccion" ? "noticias-seleccion" : "noticias-river";

    // Con override probamos solo esa fuente; sin override recorremos la lista
    // completa empezando por la que toca según la rotación. Antes, si la
    // fuente del turno no tenía nada nuevo, el ciclo entero se perdía.
    const maxIntentos = fuenteOverride ? 1 : fuentesList.length;

    let fuente: string = fuenteOverride ?? fuentesList[indiceInicial];
    let noticiaElegida: { titulo: string; url: string; fuente: string } | null = null;
    let articuloElegido: TextoArticulo | null = null;
    let huboScrapingOk = false;

    for (let intento = 0; intento < maxIntentos; intento++) {
      fuente = fuenteOverride ?? fuentesList[(indiceInicial + intento) % fuentesList.length];

      if (!fuenteOverride) {
        estado[indexKey] = indiceInicial + intento + 1;
        await guardarEstado(estado);
      } else if (categoriaOverride && esAutomatico === false) {
        // Si vino override con categoria, persistimos el flip igual
        await guardarEstado(estado);
      }

      logger.info({ categoria, fuente, intento: intento + 1, siguiente: fuentesList[estado[indexKey] % fuentesList.length] }, "Scheduler: iniciando ciclo");

      let noticias: { titulo: string; url: string; fuente: string }[] = [];
      try {
        const noticiasRes = await fetch(`http://localhost:${port}/api/${endpoint}?fuente=${fuente}`, {
          signal: AbortSignal.timeout(35000),
        });

        if (!noticiasRes.ok) {
          logger.warn({ fuente, status: noticiasRes.status }, "Scheduler: scraping falló");
          if (fuenteOverride) return { tipo: "scraping_fallido", fuente };
          continue;
        }

        const data = await noticiasRes.json() as { noticias?: { titulo: string; url: string; fuente: string }[] };
        noticias = data.noticias ?? [];
      } catch (err) {
        logger.warn({ err, fuente }, "Scheduler: error/timeout scrapeando la fuente");
        if (fuenteOverride) return { tipo: "scraping_fallido", fuente };
        continue;
      }
      huboScrapingOk = true;

      if (!noticias.length) {
        logger.warn({ fuente }, "Scheduler: no se encontraron noticias");
        if (fuenteOverride) return { tipo: "sin_noticias", fuente };
        continue;
      }

      // ── DEDUPLICACIÓN TRIPLE: URL procesada + antigüedad + título ────────
      for (const candidata of noticias) {
        // 0. Exigir una URL de artículo real; páginas de autor/sección generan
        // notas falsas o desactualizadas al mezclar varios contenidos.
        if (!pareceUrlDeArticulo(candidata.url)) {
          logger.info({ url: candidata.url, titulo: candidata.titulo }, "Scheduler: URL no corresponde a un artículo, saltando");
          continue;
        }
        // 1. Descartar si la URL ya fue procesada (igual artículo, distinto ciclo)
        if (candidata.url && urlYaProcesada(candidata.url, estado)) {
          logger.info({ url: candidata.url }, "Scheduler: URL ya procesada, saltando");
          continue;
        }
        // 1b. Chequeo permanente en DB (sin ventana de tiempo ni tope de memoria)
        if (candidata.url && (await urlYaEnDB(candidata.url))) {
          logger.info({ url: candidata.url }, "Scheduler: URL ya publicada en DB, saltando");
          continue;
        }
        // 2. Descartar si la URL tiene fecha y es ≥3 días antigua
        if (candidata.url && urlDemaisiadoVieja(candidata.url)) {
          logger.info({ url: candidata.url, titulo: candidata.titulo }, "Scheduler: artículo demasiado viejo, saltando");
          continue;
        }
        // 3. Descartar si el tema (por título) ya fue cubierto esta semana
        const yaExistePorTitulo = await tituloYaProcesado(candidata.titulo);
        if (yaExistePorTitulo) continue;

        // 4. En automático, validar el documento real ANTES de elegirlo. Si
        // falla, seguimos con la próxima noticia/fuente en este mismo ciclo.
        if (esAutomatico) {
          const articulo = await obtenerTextoArticulo(candidata.url);
          const fecha = articulo.fechaPublicacion ?? extraerFechaDeUrl(candidata.url);
          const diasAtras = fecha
            ? (Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24)
            : null;
          const motivoBloqueo =
            !articulo.esArticulo
              ? "la página no tiene evidencia de ser un artículo"
              : !articulo.texto
                ? "no se pudo extraer un cuerpo periodístico"
                : !fecha
                  ? "no tiene fecha de publicación verificable"
                  : diasAtras! < -0.5
                    ? "la fecha de publicación es futura o anómala"
                    : diasAtras! >= 2
                      ? "supera las 48 horas de antigüedad"
                      : null;

          if (motivoBloqueo) {
            logger.warn(
              {
                url: candidata.url,
                titulo: candidata.titulo,
                fecha: fecha?.toISOString() ?? null,
                diasAtras: diasAtras?.toFixed(1) ?? null,
                motivo: motivoBloqueo,
              },
              "Scheduler: candidato bloqueado por control de actualidad",
            );
            marcarUrlProcesada(candidata.url, estado);
            await guardarEstado(estado);
            continue;
          }

          articuloElegido = { ...articulo, fechaPublicacion: fecha };
        }

        noticiaElegida = candidata;
        break;
      }

      if (noticiaElegida) break;

      logger.warn({ fuente }, "Scheduler: todas las noticias de esta fuente ya fueron procesadas o son antiguas, probando la siguiente");
    }

    if (!noticiaElegida) {
      logger.warn({ fuente }, "Scheduler: ninguna fuente tuvo noticias nuevas en este ciclo");
      return huboScrapingOk ? { tipo: "todas_procesadas", fuente } : { tipo: "scraping_fallido", fuente };
    }

    logger.info({ titulo: noticiaElegida.titulo, url: noticiaElegida.url }, "Scheduler: noticia seleccionada");

    // ── EXTRAER TEXTO DEL ARTÍCULO + VALIDAR FECHA ────────────────────────
    let textoParaIA = noticiaElegida.titulo;
    let imagenAutoUrl: string | null = null;
    let fechaPublicacionVerificada: Date | null = null;
    if (noticiaElegida.url) {
      const { texto, fechaPublicacion: fechaHtml, imagenUrl } =
        articuloElegido ?? await obtenerTextoArticulo(noticiaElegida.url);
      const fechaPublicacion = fechaHtml ?? extraerFechaDeUrl(noticiaElegida.url);
      fechaPublicacionVerificada = fechaPublicacion;
      imagenAutoUrl = imagenUrl;

      // Rechazar fechas futuras anómalas y artículos de más de 48 horas en el
      // flujo automático. Los pedidos manuales mantienen el máximo de 3 días.
      if (fechaPublicacion) {
        const diasAtras = (Date.now() - fechaPublicacion.getTime()) / (1000 * 60 * 60 * 24);
        const limiteDias = esAutomatico ? 2 : 3;
        if (diasAtras < -0.5 || diasAtras >= limiteDias) {
          logger.warn(
            { url: noticiaElegida.url, titulo: noticiaElegida.titulo, diasAtras: diasAtras.toFixed(1), limiteDias, fecha: fechaPublicacion.toISOString() },
            "Scheduler: fecha fuera de la ventana de actualidad, descartando"
          );
          // Marcar como procesada para no volver a intentarlo
          marcarUrlProcesada(noticiaElegida.url, estado);
          await guardarEstado(estado);
          return { tipo: "todas_procesadas", fuente };
        }
        logger.info({ fechaPublicacion: fechaPublicacion.toISOString(), diasAtras: diasAtras.toFixed(1), limiteDias }, "Scheduler: artículo dentro del rango de actualidad");
      }

      if (texto) {
        textoParaIA = `${noticiaElegida.titulo}\n\n${texto}`;
      }
    }

    // ── GENERAR CON IA (Gemini Flash) ─────────────────────────────────────
    const promptSistema = categoria === "seleccion" ? PROMPT_SELECCION : PROMPT_MAESTRO;
    const contextoSitio = categoria === "seleccion"
      ? "Transformá esta noticia para el sitio La Scaloneta en Israel"
      : "Transformá esta noticia para el sitio River en Israel";
    const tagsFallback = categoria === "seleccion"
      ? "#Argentina #Scaloneta #Mundial2026 #LaScaloneta"
      : "#RiverPlate #RiverIsrael #RamatGan #ElMasGrande";
    const solicitudConFuente = `${contextoSitio}.
Fecha actual: ${new Date().toISOString()}.
Fecha verificada del artículo: ${fechaPublicacionVerificada?.toISOString() ?? "no disponible (pedido manual)"}.
URL de la fuente: ${noticiaElegida.url}.
Usá únicamente los hechos presentes en este texto fuente:

${textoParaIA}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: solicitudConFuente }] }],
      config: {
        systemInstruction: promptSistema,
        maxOutputTokens: 8000,
      },
    });

    let resultado = response.text ?? "";
    if (!resultado || resultado.length < 50) {
      logger.error("Scheduler: la IA no generó contenido");
      return { tipo: "ia_sin_contenido" };
    }

    logger.info({
      chars: resultado.length,
      preview: resultado.slice(0, 200).replace(/\n/g, "↵"),
    }, "Scheduler: output AI inicial");

    // ── CONTROL DE CALIDAD PRE-GUARDADO ───────────────────────────────────
    let parsed = parsearResultado(resultado);
    const MINIMO_CHARS = 1400;
    const cortada = /[…\.]{3,}\s*$/.test(parsed.contenido.trimEnd());
    const corta   = parsed.contenido.length < MINIMO_CHARS;

    if (corta || cortada) {
      logger.warn({
        chars: parsed.contenido.length,
        cortada,
      }, "Scheduler: nota insuficiente, solicitando expansión a la IA");
      const expansion = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: "user",  parts: [{ text: solicitudConFuente }] },
          { role: "model", parts: [{ text: resultado }] },
          { role: "user",  parts: [{ text: "La nota está incompleta o es demasiado corta (mínimo 1400 caracteres). Continuá y expandí: desarrollá el análisis, el contexto histórico y las preguntas que quedan abiertas. Cerrá siempre con un párrafo contundente desde la perspectiva de la Filial River Plate Israel Gaby \"Tucu\" Sajnin. La última palabra debe ser punto final, nunca puntos suspensivos ni cortes abruptos." }] },
        ],
        config: { systemInstruction: promptSistema, maxOutputTokens: 8000 },
      });
      const resultadoExpandido = expansion.text ?? "";
      if (resultadoExpandido && resultadoExpandido.length > resultado.length) {
        resultado = resultadoExpandido;
        parsed = parsearResultado(resultado);
        logger.info({ chars: parsed.contenido.length }, "Scheduler: expansión aplicada");
      }
    }

    const { titulo, contenido } = parsed;
    // Cinturón de seguridad editorial: aunque una fuente reciente conserve
    // contexto viejo o la IA ignore el prompt, una nota automática no puede
    // presentar nuevamente a Coudet como parte de la actualidad de River.
    // Las menciones históricas pueden revisarse mediante el flujo manual.
    if (
      esAutomatico &&
      categoria === "river" &&
      /\b(coudet|chacho|eduardo\s+ponzio)\b/i.test(`${titulo}\n${contenido}`)
    ) {
      logger.error(
        { url: noticiaElegida.url, titulo },
        "Scheduler: nota bloqueada por contexto técnico desactualizado",
      );
      marcarUrlProcesada(noticiaElegida.url, estado);
      await guardarEstado(estado);
      return { tipo: "todas_procesadas", fuente };
    }
    // Si la IA dejó el fallback de River para una nota de Selección (raro pero posible),
    // sustituimos por los tags correctos de la categoría.
    let { tags } = parsed;
    if (categoria === "seleccion" && /^#RiverPlate/.test(tags.trim())) {
      tags = tagsFallback;
    }
    const fuenteNombre = noticiaElegida.fuente ?? fuente;

    // ── PORTADA GARANTIZADA ───────────────────────────────────────────────
    // Descargamos la imagen del artículo al object storage; si no hay o falla,
    // usamos una foto de respaldo de la galería. Nunca se publica sin foto.
    let imagenPortadaFinal: string | null = null;
    if (imagenAutoUrl) {
      imagenPortadaFinal = await guardarPortadaEnStorage(imagenAutoUrl);
    }
    // Regla (pedido del usuario, ago 2026): en modo automático la nota SIEMPRE
    // se autopublica en el sitio. Si el artículo no traía foto (o falló la
    // descarga), se usa una foto de respaldo de la galería y se avisa en la
    // notificación de Telegram para que puedan cambiarla desde el Redactor.
    const autopublicar = esAutomatico;
    const usoFallback = !imagenPortadaFinal;
    if (!imagenPortadaFinal) {
      imagenPortadaFinal = portadaFallback();
      logger.info({ portada: imagenPortadaFinal }, "Scheduler: usando foto de portada de respaldo");
    }

    // ── GUARDAR EN DB ─────────────────────────────────────────────────────
    // Modo automático: autopublicación directa.
    // Modo manual (/buscar, /noticia): pendiente de aprobación.
    const [savedNoticia] = await db
      .insert(noticiasTable)
      .values({
        titulo,
        contenido,
        tags,
        textoOriginal: textoParaIA.slice(0, 3000),
        fuente: fuenteNombre,
        categoria,
        publicada: autopublicar,
        pendiente: !autopublicar,
        imagenPortada: imagenPortadaFinal,
        urlFuente: noticiaElegida.url ? normalizarUrl(noticiaElegida.url) : "",
      })
      // Índice único parcial en url_fuente: si otro proceso ya guardó esta URL,
      // no insertamos un duplicado.
      .onConflictDoNothing()
      .returning();

    if (!savedNoticia) {
      logger.warn({ url: noticiaElegida.url }, "Scheduler: URL ya insertada por otro proceso, saltando duplicado");
      if (noticiaElegida.url) {
        marcarUrlProcesada(noticiaElegida.url, estado);
        await guardarEstado(estado);
      }
      return { tipo: "todas_procesadas", fuente };
    }

    // Marcar URL como procesada para no volver a enviarla
    if (noticiaElegida.url) {
      marcarUrlProcesada(noticiaElegida.url, estado);
      await guardarEstado(estado);
    }

    // ── ENVIAR A TELEGRAM ─────────────────────────────────────────────────
    // Las notas de Selección van al bot de la Scaloneta; las de River al de River.
    const cred = credencialesTelegram(categoria === "seleccion" ? "seleccion" : "river");

    if (!cred) {
      logger.warn({ categoria }, "Scheduler: bot de Telegram para esta categoría no configurado, nota guardada sin enviar");
      return { tipo: "ok", titulo, id: savedNoticia.id, fuente: fuenteNombre };
    }
    const { token, chatId } = cred;

    const dominioTelegram = process.env.TELEGRAM_WEBHOOK_DOMAIN ?? "riverplateisrael.com";
    const TELEGRAM_MAX = 4096;

    // 🌐 Si se publicó automáticamente, lanzar traducción al hebreo en background
    if (autopublicar && savedNoticia) {
      traducirYGuardarHebreo(savedNoticia.id).catch(() => {});
      // 📸 Instagram vía Make.com (fire-and-forget)
      enviarNotaAMake(savedNoticia);
    }

    // Escape básico de Markdown para campos dinámicos (título/fuente) que van
    // dentro de *...* o _..._ — evita errores de parseo en Telegram.
    const escMd = (s: string) => s.replace(/([*_`[\]])/g, "");

    // Foto de portada para Telegram: la del artículo si existe (solo URLs
    // absolutas http/https), o la de respaldo (absolutizada al dominio del sitio).
    const imagenAutoAbsoluta = imagenAutoUrl?.startsWith("//")
      ? `https:${imagenAutoUrl}`
      : imagenAutoUrl?.startsWith("http")
        ? imagenAutoUrl
        : null;
    const fotoParaTelegram =
      imagenAutoAbsoluta ??
      (imagenPortadaFinal?.startsWith("/objects/")
        ? `https://${dominioTelegram}/api/storage${imagenPortadaFinal}`
        : imagenPortadaFinal
          ? `https://${dominioTelegram}${imagenPortadaFinal}`
          : null);
    const capFotoBase = usoFallback
      ? `🖼 _Foto de respaldo (el artículo no traía foto; podés cambiarla desde el Redactor) — ${escMd(titulo)}_`
      : `🖼 _Foto de portada — ${escMd(titulo)}_`;
    // Telegram limita los captions a 1024 caracteres
    const capFoto = capFotoBase.length > 1024 ? capFotoBase.slice(0, 1023) + "_" : capFotoBase;
    if (fotoParaTelegram) {
      await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          photo: fotoParaTelegram,
          caption: capFoto,
          parse_mode: "Markdown",
        }),
      }).catch(() => { /* no bloquear si falla la foto */ });
    }

    if (autopublicar) {
      // ── MODO AUTOMÁTICO: ya publicada en el sitio; llega la notificación
      // completa: foto (arriba), categoría, título, artículo y fuente.
      const etiquetaCat = categoria === "seleccion"
        ? "🇦🇷 _Categoría: Selección Argentina_\n\n"
        : "⚪️🔴 _Categoría: River_\n\n";
      const encabezadoFYI = `✅ *Nota autopublicada en el sitio*\n\n${etiquetaCat}📰 *${escMd(titulo)}*\n\n`;
      const pieFYI = `\n\n${tags}\n\n📡 _Fuente: ${escMd(fuenteNombre)}_\n⏱ _El link de edición dura ${descripcionTtlEdicion()}_`;
      const textoFYICompleto = encabezadoFYI + contenido + pieFYI;
      const mensajeFIY = textoFYICompleto.length > TELEGRAM_MAX
        ? textoFYICompleto.slice(0, TELEGRAM_MAX - 1).replace(/[^.!?…]*$/, "") + "."
        : textoFYICompleto;
      const resFYI = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: mensajeFIY,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              { text: "🌐 Ver la nota", url: `https://${dominioTelegram}/noticia/${savedNoticia.id}` },
              { text: "✏️ Editar en Redactor", url: `https://${dominioTelegram}/redactor?editar=${savedNoticia.id}&edit_token=${await createEditToken(savedNoticia.id)}` },
            ]],
          },
        }),
      });
      const dataFYI = await resFYI.json().catch(() => null) as { ok?: boolean; description?: string } | null;
      if (!resFYI.ok || !dataFYI?.ok) {
        logger.error({ status: resFYI.status, dataFYI }, "Scheduler: la nota se autopublicó pero falló la notificación de Telegram");
      }
      logger.info({ titulo, id: savedNoticia.id, fuente, imagenAutoUrl, usoFallback }, "Scheduler: nota autopublicada");
      // 📣 Promoción automática en el canal público (fire-and-forget)
      promocionarNotaEnCanal(savedNoticia).catch(() => {});
    } else {
      // ── MODO MANUAL / PENDIENTE: artículo completo + 2 botones ────────

      // Artículo completo — sin truncar. El contenido redactado cabe dentro de 4096 chars.
      const replyMarkup = {
        inline_keyboard: [[
          { text: "✅ Publicar", callback_data: `publicar_${savedNoticia.id}` },
          { text: "✏️ Editar",  callback_data: `editar_${savedNoticia.id}` },
        ]],
      };

      const etiquetaCatMan = categoria === "seleccion"
        ? "🇦🇷 _Categoría: Selección Argentina_\n\n"
        : "⚪️🔴 _Categoría: River_\n\n";
      const encabezado = `${etiquetaCatMan}📰 *${escMd(titulo)}*\n\n`;
      const pie        = `\n\n${tags}\n\n📡 _Fuente: ${escMd(fuenteNombre)}_`;
      const textoCompleto = encabezado + contenido + pie;
      // Salvaguarda: si supera 4096 cortamos en oración completa
      const texto = textoCompleto.length > TELEGRAM_MAX
        ? textoCompleto.slice(0, TELEGRAM_MAX - 1).replace(/[^.!?…]*$/, "") + "."
        : textoCompleto;

      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: texto,
          parse_mode: "Markdown",
          reply_markup: replyMarkup,
        }),
      });

      const tgData = await tgRes.json() as { ok: boolean; result?: { message_id: number } };
      if (!tgRes.ok || !tgData.ok) {
        logger.error({ tgData }, "Scheduler: error enviando a Telegram");
        return { tipo: "telegram_error", fuente: fuenteNombre };
      }

      const messageId = String(tgData.result?.message_id ?? "");
      if (messageId) {
        await db
          .update(noticiasTable)
          .set({ telegramMessageId: messageId })
          .where(eq(noticiasTable.id, savedNoticia.id));
      }
    }

    logger.info({ titulo, id: savedNoticia.id, fuente, esAutomatico, url: noticiaElegida.url }, "Scheduler: ciclo completado correctamente");
    return { tipo: "ok", titulo, id: savedNoticia.id, fuente: fuenteNombre };

  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Scheduler: error inesperado en ciclo automático");
    return { tipo: "error", mensaje };
  } finally {
    enEjecucion = false;
  }
}

export { ejecutarCiclo };

// ─── RESUMEN DIARIO DE TRADUCCIONES AL HEBREO EN BORRADOR ─────────────────────
// Una vez al día (09:00 hora Israel) cuenta las noticias con `hebreoPublicada=false`
// y `contenidoHe` no vacío, y manda al admin un Telegram con el listado de títulos
// en español y un link a /redactor?tab=publicaciones-hebreo.
// Se desactiva con `RESUMEN_HEBREO_DIARIO=0`.

function ultimoDiaSemanaUtil(year: number, month: number, weekday: number): number {
  const ultimoDia = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  for (let d = ultimoDia; d > 0; d--) {
    if (new Date(Date.UTC(year, month, d)).getUTCDay() === weekday) return d;
  }
  return ultimoDia;
}

function israelOffsetHorasInterno(utcMs: number): number {
  const d = new Date(utcMs);
  const year = d.getUTCFullYear();
  const inicioIDT = Date.UTC(year, 2, ultimoDiaSemanaUtil(year, 2, 5), 0, 0, 0);
  const finIDT = Date.UTC(year, 9, ultimoDiaSemanaUtil(year, 9, 0), 23, 0, 0) - 24 * 3600_000;
  return utcMs >= inicioIDT && utcMs < finIDT ? 3 : 2;
}

// Devuelve la fecha (YYYY-MM-DD) y la hora (0-23) actuales en horario Israel.
function israelAhora(): { fecha: string; hora: number } {
  const ahoraUtc = Date.now();
  const offset = israelOffsetHorasInterno(ahoraUtc);
  const ilMs = ahoraUtc + offset * 3600_000;
  const d = new Date(ilMs);
  const fecha = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  return { fecha, hora: d.getUTCHours() };
}

export async function enviarResumenHebreoDiario(): Promise<void> {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    logger.warn("Resumen hebreo diario: Telegram no configurado, saltando");
    return;
  }

  const escape = (s: string) => s.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
  const MAX_LISTADO = 15;
  const dominio = process.env.TELEGRAM_WEBHOOK_DOMAIN ?? "riverplateisrael.com";

  // Interruptores por sección (panel /redactor; env como fallback default).
  const settings = leerRedactorSettings();
  const hebreoActivo = settings.resumenSeccionHebreo;
  const postulacionesActivas = settings.resumenSeccionPostulaciones;
  const borradoresEsActivos = settings.resumenSeccionBorradoresEs;

  // ── Traducciones al hebreo en borrador ──────────────────────────────────
  // Desactivable desde el panel (o RESUMEN_HEBREO_DIARIO=0 como fallback).
  // Queries compartidas con el panel /redactor en lib/resumen-pendientes.ts.
  const pendientesHebreo = hebreoActivo ? await listarPendientesHebreo() : [];

  // ── Postulaciones de redactores sin revisar ─────────────────────────────
  // Desactivable desde el panel (o RESUMEN_POSTULACIONES_DIARIO=0 como fallback).
  const pendientesPostulaciones = postulacionesActivas
    ? await listarPendientesPostulaciones()
    : [];

  // ── Borradores en español sin publicar (modo manual, esperando aprobación) ─
  // Desactivable desde el panel (o RESUMEN_BORRADORES_ES_DIARIO=0 como fallback).
  const pendientesBorradoresEs = borradoresEsActivos
    ? await listarPendientesBorradoresEs()
    : [];

  if (
    pendientesHebreo.length === 0 &&
    pendientesPostulaciones.length === 0 &&
    pendientesBorradoresEs.length === 0
  ) {
    logger.info("Resumen diario: no hay traducciones, postulaciones ni borradores pendientes, no se envía mensaje");
    return;
  }

  // Token de un solo uso para que el admin entre directo al redactor sin tipear
  // la contraseña. Como el resumen abarca varias notas, el token no está scoped
  // a ninguna en particular: al canjearse genera una sesión admin corta.
  // TTL largo (24h): el admin puede ver el aviso a la noche y entrar a la mañana
  // sin que el link caduque.
  const editToken = await createLongEditToken(null);

  const secciones: string[] = [];

  if (pendientesHebreo.length > 0) {
    const link = `https://${dominio}/redactor?tab=publicaciones-hebreo&edit_token=${editToken}`;
    const listado = pendientesHebreo.slice(0, MAX_LISTADO)
      .map((n) => `• ${escape(n.titulo)}`)
      .join("\n");
    const resto = pendientesHebreo.length - MAX_LISTADO;
    const sufijo = resto > 0 ? `\n_…y ${resto} más_` : "";
    secciones.push(
      `✡ *Resumen diario — traducciones al hebreo pendientes*\n\n` +
      `Hay *${pendientesHebreo.length}* ${pendientesHebreo.length === 1 ? "traducción" : "traducciones"} en borrador esperando revisión:\n\n` +
      `${listado}${sufijo}\n\n` +
      `[Revisar y publicar en /redactor](${link})`,
    );
  }

  if (pendientesPostulaciones.length > 0) {
    const link = `https://${dominio}/redactor?tab=postulantes&edit_token=${editToken}`;
    const listado = pendientesPostulaciones.slice(0, MAX_LISTADO)
      .map((n) => `• ${escape(n.titulo)}`)
      .join("\n");
    const resto = pendientesPostulaciones.length - MAX_LISTADO;
    const sufijo = resto > 0 ? `\n_…y ${resto} más_` : "";
    secciones.push(
      `✍ *Postulaciones de redactores sin revisar*\n\n` +
      `Hay *${pendientesPostulaciones.length}* ${pendientesPostulaciones.length === 1 ? "postulación" : "postulaciones"} esperando revisión:\n\n` +
      `${listado}${sufijo}\n\n` +
      `[Revisar en /redactor](${link})`,
    );
  }

  if (pendientesBorradoresEs.length > 0) {
    const link = `https://${dominio}/redactor?tab=publicaciones&edit_token=${editToken}`;
    const listado = pendientesBorradoresEs.slice(0, MAX_LISTADO)
      .map((n) => `• ${escape(n.titulo)}`)
      .join("\n");
    const resto = pendientesBorradoresEs.length - MAX_LISTADO;
    const sufijo = resto > 0 ? `\n_…y ${resto} más_` : "";
    secciones.push(
      `📝 *Borradores en español sin publicar*\n\n` +
      `Hay *${pendientesBorradoresEs.length}* ${pendientesBorradoresEs.length === 1 ? "nota" : "notas"} esperando aprobación:\n\n` +
      `${listado}${sufijo}\n\n` +
      `[Revisar y publicar en /redactor](${link})`,
    );
  }

  const cuerpo = secciones.join("\n\n━━━━━━━━━━\n\n");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: cuerpo,
      parse_mode: "MarkdownV2",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.warn({ status: res.status, body }, "Resumen diario: Telegram sendMessage falló");
    return;
  }
  logger.info(
    {
      hebreo: pendientesHebreo.length,
      postulaciones: pendientesPostulaciones.length,
      borradoresEs: pendientesBorradoresEs.length,
    },
    "Resumen diario enviado",
  );
}

// Ticker que revisa cada minuto la hora configurada (en horario Israel) desde
// los settings del panel. Cuando la hora actual coincide con la configurada y
// no se envió ya hoy, dispara el resumen. La hora se relee en cada tick, por lo
// que cambiarla desde /redactor surte efecto sin reiniciar el server.
// Si la hora es null (vacío en el panel), el resumen queda desactivado.
const CHECK_RESUMEN_MS = 60 * 1000;

function tickResumenHebreoDiario(): void {
  const settings = leerRedactorSettings();
  const hora = settings.resumenHebreoHora;
  if (hora === null) return; // desactivado desde el panel
  const { fecha, hora: horaActual } = israelAhora();
  if (horaActual !== hora) return; // todavía no es la hora configurada
  if (settings.resumenHebreoUltimoEnvio === fecha) return; // ya se envió hoy
  // Marcar como enviado ANTES de despachar para evitar dobles disparos.
  guardarRedactorSettings({ resumenHebreoUltimoEnvio: fecha });
  logger.info({ horaIsrael: hora, fecha }, "Resumen hebreo diario: hora alcanzada, enviando");
  enviarResumenHebreoDiario().catch((err) =>
    logger.error({ err }, "Resumen hebreo diario: error inesperado"),
  );
}

function iniciarResumenHebreoDiario(): void {
  setInterval(tickResumenHebreoDiario, CHECK_RESUMEN_MS);
  logger.info("Resumen hebreo diario: ticker iniciado (revisa la hora configurada cada minuto)");
}

// ─── INTERVALO: cada 2 horas ───────────────────────────────────────────────
// Primer ciclo a los 2 minutos de arrancar, luego cada 2 horas exactas.

const INTERVALO_MS   = 2 * 60 * 60 * 1000; // 2 horas
const PRIMER_CICLO_MS =  2 * 60 * 1000; // 2 minutos tras arrancar

// La Scaloneta está oculta: el ciclo periódico publica SOLO noticias de River
// (web, Telegram e Instagram). La categoría "seleccion" queda disponible solo
// para disparos manuales desde el panel/trigger.
function ejecutarCicloPeriodico(): void {
  // Modo automático: la nota se publica directamente en el sitio (con foto de
  // portada garantizada) y el bot de Telegram avisa con un link de edición.
  ejecutarCiclo(undefined, true, "river").catch((err) =>
    logger.error({ err }, "Scheduler: error no capturado en ciclo periódico"),
  );
}

export function iniciarScheduler(): void {
  logger.info({ primerCicloMinutos: 2, intervaloHoras: 2 }, "Scheduler automático iniciado — primer ciclo en 2 min, luego cada 2 horas");

  iniciarResumenHebreoDiario();

  // Limpieza de edit_tokens y sesiones del panel expirados — corre cada hora.
  const UNA_HORA_MS = 60 * 60 * 1000;
  const purgar = (etapa: string): void => {
    purgeExpiredEditTokens().catch((err) =>
      logger.error({ err }, `purgeExpiredEditTokens: error ${etapa}`),
    );
    purgeExpiredSessions().catch((err) =>
      logger.error({ err }, `purgeExpiredSessions: error ${etapa}`),
    );
  };
  purgar("inicial");
  setInterval(() => purgar("periódico"), UNA_HORA_MS);

  setTimeout(() => {
    ejecutarCicloPeriodico();

    setInterval(() => {
      ejecutarCicloPeriodico();
    }, INTERVALO_MS);
  }, PRIMER_CICLO_MS);
}
