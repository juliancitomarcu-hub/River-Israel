import { ai } from "@workspace/integrations-gemini-ai";
import { generarImagenIG } from "./lib/generar-imagen-ig";
import { db } from "@workspace/db";
import { noticiasTable } from "@workspace/db";
import { and, desc, eq, sql as sqlRaw } from "drizzle-orm";
import * as cheerio from "cheerio";
import { logger } from "./lib/logger";
import * as fs from "fs";
import * as path from "path";
import { PROMPT_MAESTRO } from "./lib/prompt-maestro";
import { PROMPT_SELECCION } from "./lib/prompt-seleccion";
import { traducirYGuardarHebreo } from "./lib/traductor-hebreo";

export type Categoria = "river" | "seleccion";

// Fuentes en orden de prioridad — La Página Millonaria, sitio oficial y Olé primero
const FUENTES = [
  "pagina", "cariverplate", "ole", "tyc",
  "google", "infobae", "clarin", "lanacion",
  "bolavip", "as", "superdeportivo"
] as const;

const FUENTES_SELECCION = ["ole", "tyc", "google"] as const;

// ─── ESTADO PERSISTENTE ───────────────────────────────────────────────────────

const STATE_FILE = path.resolve("./scheduler_state.json");

interface SchedulerState {
  fuenteIndex: number;
  fuenteIndexSel: number;
  categoriaFlip: number; // alterna 0/1 entre river y seleccion en cada ciclo automático
  urlsProcesadas: string[];  // URLs ya enviadas a Telegram (cap 1000)
}

function leerEstado(): SchedulerState {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) as Partial<SchedulerState>;
    return {
      fuenteIndex:    typeof raw.fuenteIndex === "number" ? raw.fuenteIndex : 0,
      fuenteIndexSel: typeof raw.fuenteIndexSel === "number" ? raw.fuenteIndexSel : 0,
      categoriaFlip:  typeof raw.categoriaFlip === "number" ? raw.categoriaFlip : 0,
      urlsProcesadas: Array.isArray(raw.urlsProcesadas) ? raw.urlsProcesadas : [],
    };
  } catch {
    return { fuenteIndex: 0, fuenteIndexSel: 0, categoriaFlip: 0, urlsProcesadas: [] };
  }
}

function guardarEstado(estado: SchedulerState): void {
  try {
    // Cap en 1000 URLs para no crecer indefinidamente
    if (estado.urlsProcesadas.length > 1000) {
      estado.urlsProcesadas = estado.urlsProcesadas.slice(-1000);
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(estado), "utf-8");
  } catch (err) {
    logger.warn({ err }, "Scheduler: no se pudo guardar el estado");
  }
}

// ─── DEDUPLICACIÓN POR URL ────────────────────────────────────────────────────
function urlYaProcesada(url: string, estado: SchedulerState): boolean {
  if (!url) return false;
  return estado.urlsProcesadas.includes(url);
}

function marcarUrlProcesada(url: string, estado: SchedulerState): void {
  if (!url || estado.urlsProcesadas.includes(url)) return;
  estado.urlsProcesadas.push(url);
}

// ─── FILTRO DE ANTIGÜEDAD POR URL ─────────────────────────────────────────────
// Muchos sitios incluyen la fecha en la URL: /2026/04/07/ o -2026-04-07-
// Si detectamos fecha en la URL y es ≥ 3 días, la descartamos.
function urlDemaisiadoVieja(url: string): boolean {
  if (!url) return false;
  // Patrón /YYYY/MM/DD/ o -YYYY-MM-DD o similar
  const m = url.match(/[\/\-](20\d{2})[\/\-](\d{2})[\/\-](\d{2})[\/\-]/);
  if (!m) return false;
  const [, anio, mes, dia] = m.map(Number);
  const fechaArticulo = Date.UTC(anio, mes - 1, dia);
  const ahora = Date.now();
  const diasAtras = (ahora - fechaArticulo) / (1000 * 60 * 60 * 24);
  return diasAtras >= 3;
}

// ─── DEDUPLICACIÓN POR DB ─────────────────────────────────────────────────────
// Compara el título candidato con las noticias de los últimos 7 días.
// Si 4 o más palabras significativas (≥5 chars) coinciden → mismo tema → saltar.
// Umbral = 4 palabras (antes 3) para evitar falsos positivos en noticias distintas.

async function tituloYaProcesado(titulo: string): Promise<boolean> {
  try {
    const res = await db.execute(sqlRaw`
      SELECT titulo FROM noticias
      WHERE created_at > NOW() - INTERVAL '7 days'
    `);

    const palabras = titulo
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z\s]/g, "")
      .split(/\s+/)
      .filter(p => p.length >= 5);  // palabras más largas = más significativas

    if (palabras.length === 0) return false;

    for (const row of res.rows as { titulo: string }[]) {
      const existente = row.titulo
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z\s]/g, "");
      const coincidencias = palabras.filter(p => existente.includes(p));
      if (coincidencias.length >= 4) {
        logger.info({ candidato: titulo, existente: row.titulo, coincidencias }, "Scheduler: tema repetido, saltando");
        return true;
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

  // Si la bajada es valiosa, la prepend como cursiva
  if (bajada) {
    contenido = `*${bajada}*\n\n${contenido}`;
  }

  return { titulo, contenido, tags };
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

// Extrae la fecha de publicación del artículo leyendo metadatos del HTML.
// Devuelve un Date o null si no se pudo determinar.
function extraerFechaDeHtml($: ReturnType<typeof cheerio.load>): Date | null {
  // 1. Open Graph / article:published_time
  const ogDate = $('meta[property="article:published_time"]').attr("content")
    ?? $('meta[name="article:published_time"]').attr("content")
    ?? $('meta[property="article:modified_time"]').attr("content");
  if (ogDate) {
    const d = new Date(ogDate);
    if (!isNaN(d.getTime())) return d;
  }

  // 2. <time> con datetime
  const timeEl = $("time[datetime]").first().attr("datetime");
  if (timeEl) {
    const d = new Date(timeEl);
    if (!isNaN(d.getTime())) return d;
  }

  // 3. JSON-LD datePublished
  let ldDate: string | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (ldDate) return;
    try {
      const obj = JSON.parse($(el).text()) as Record<string, unknown>;
      const dp = obj["datePublished"] ?? obj["dateModified"];
      if (typeof dp === "string") ldDate = dp;
    } catch { /* skip */ }
  });
  if (ldDate) {
    const d = new Date(ldDate);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

interface TextoArticulo {
  texto: string;
  fechaPublicacion: Date | null;
  imagenUrl: string | null;
}

async function obtenerTextoArticulo(url: string): Promise<TextoArticulo> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { texto: "", fechaPublicacion: null, imagenUrl: null };
    const html = await res.text();
    const $ = cheerio.load(html);

    const fechaPublicacion = extraerFechaDeHtml($);

    // Extraer imagen principal del artículo
    const imagenUrl =
      $('meta[property="og:image"]').attr("content") ??
      $('meta[name="twitter:image"]').attr("content") ??
      $('meta[property="og:image:url"]').attr("content") ??
      $('meta[name="og:image"]').attr("content") ??
      null;

    // Selectores en orden de prioridad; incluye cariverplate.com.ar (#wrappertext) y otros sitios
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

    let parrafos = $(SELECTORES)
      .map((_idx, el) => limpiarTexto($(el).text().trim()))
      .get()
      .filter((t: string) => t.length > 50);

    // Fallback: si ningún selector especializado funcionó, buscar todos los <p> con texto
    if (parrafos.length === 0) {
      parrafos = $("p")
        .map((_idx, el) => limpiarTexto($(el).text().trim()))
        .get()
        .filter((t: string) => t.length > 80);
    }

    const texto = parrafos.slice(0, 20).join("\n\n");
    return { texto: texto.length > 200 ? texto : "", fechaPublicacion, imagenUrl };
  } catch {
    return { texto: "", fechaPublicacion: null, imagenUrl: null };
  }
}

// ─── TIPO DE RESULTADO DEL CICLO ──────────────────────────────────────────────
export type EjecucionResultado =
  | { tipo: "concurrente" }
  | { tipo: "scraping_fallido"; fuente: string }
  | { tipo: "sin_noticias"; fuente: string }
  | { tipo: "todas_procesadas"; fuente: string }
  | { tipo: "ia_sin_contenido" }
  | { tipo: "telegram_error"; fuente: string }
  | { tipo: "ok"; titulo: string; id: number; fuente: string }
  | { tipo: "error"; mensaje: string };

// ─── FLAG ANTI-CONCURRENCIA ───────────────────────────────────────────────────
let enEjecucion = false;

async function ejecutarCiclo(fuenteOverride?: string, esAutomatico = false, categoriaOverride?: Categoria): Promise<EjecucionResultado> {
  if (enEjecucion) {
    logger.warn("Scheduler: ciclo anterior aún en ejecución, saltando este turno");
    return { tipo: "concurrente" };
  }
  enEjecucion = true;

  try {
    const estado = leerEstado();

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
    const fuente = fuenteOverride ?? fuentesList[estado[indexKey] % fuentesList.length];

    if (!fuenteOverride) {
      estado[indexKey] += 1;
      guardarEstado(estado);
    } else if (categoriaOverride && esAutomatico === false) {
      // Si vino override con categoria, persistimos el flip igual
      guardarEstado(estado);
    }

    logger.info({ categoria, fuente, siguiente: fuentesList[estado[indexKey] % fuentesList.length] }, "Scheduler: iniciando ciclo");

    const port = process.env.PORT;
    const endpoint = categoria === "seleccion" ? "noticias-seleccion" : "noticias-river";
    const noticiasRes = await fetch(`http://localhost:${port}/api/${endpoint}?fuente=${fuente}`, {
      signal: AbortSignal.timeout(35000),
    });

    if (!noticiasRes.ok) {
      logger.warn({ fuente, status: noticiasRes.status }, "Scheduler: scraping falló");
      return { tipo: "scraping_fallido", fuente };
    }

    const data = await noticiasRes.json() as { noticias?: { titulo: string; url: string; fuente: string }[] };
    const noticias = data.noticias ?? [];

    if (!noticias.length) {
      logger.warn({ fuente }, "Scheduler: no se encontraron noticias");
      return { tipo: "sin_noticias", fuente };
    }

    // ── DEDUPLICACIÓN TRIPLE: URL procesada + antigüedad + título ────────
    let noticiaElegida: typeof noticias[0] | null = null;

    for (const candidata of noticias) {
      // 1. Descartar si la URL ya fue procesada (igual artículo, distinto ciclo)
      if (candidata.url && urlYaProcesada(candidata.url, estado)) {
        logger.info({ url: candidata.url }, "Scheduler: URL ya procesada, saltando");
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

      noticiaElegida = candidata;
      break;
    }

    if (!noticiaElegida) {
      logger.warn({ fuente }, "Scheduler: todas las noticias disponibles ya fueron procesadas o son antiguas");
      return { tipo: "todas_procesadas", fuente };
    }

    logger.info({ titulo: noticiaElegida.titulo, url: noticiaElegida.url }, "Scheduler: noticia seleccionada");

    // ── EXTRAER TEXTO DEL ARTÍCULO + VALIDAR FECHA ────────────────────────
    let textoParaIA = noticiaElegida.titulo;
    let imagenAutoUrl: string | null = null;
    if (noticiaElegida.url) {
      const { texto, fechaPublicacion, imagenUrl } = await obtenerTextoArticulo(noticiaElegida.url);
      imagenAutoUrl = imagenUrl;

      // Si la fecha del artículo es detectable y tiene más de 3 días, descartar
      if (fechaPublicacion) {
        const diasAtras = (Date.now() - fechaPublicacion.getTime()) / (1000 * 60 * 60 * 24);
        if (diasAtras >= 3) {
          logger.warn(
            { url: noticiaElegida.url, titulo: noticiaElegida.titulo, diasAtras: diasAtras.toFixed(1), fecha: fechaPublicacion.toISOString() },
            "Scheduler: artículo viejo detectado por fecha del HTML, descartando"
          );
          // Marcar como procesada para no volver a intentarlo
          marcarUrlProcesada(noticiaElegida.url, estado);
          guardarEstado(estado);
          return { tipo: "todas_procesadas", fuente };
        }
        logger.info({ fechaPublicacion: fechaPublicacion.toISOString(), diasAtras: diasAtras.toFixed(1) }, "Scheduler: artículo dentro del rango de fechas");
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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: `${contextoSitio}:\n\n${textoParaIA}` }] }],
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
    const MINIMO_CHARS = 2000;
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
          { role: "user",  parts: [{ text: `${contextoSitio}:\n\n${textoParaIA}` }] },
          { role: "model", parts: [{ text: resultado }] },
          { role: "user",  parts: [{ text: "La nota está incompleta o es demasiado corta (mínimo 2000 caracteres). Continuá y expandí: desarrollá el análisis, el contexto histórico y las preguntas que quedan abiertas. Cerrá siempre con un párrafo contundente desde la perspectiva de la Filial Ramat Gan. La última palabra debe ser punto final, nunca puntos suspensivos ni cortes abruptos." }] },
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
    // Si la IA dejó el fallback de River para una nota de Selección (raro pero posible),
    // sustituimos por los tags correctos de la categoría.
    let { tags } = parsed;
    if (categoria === "seleccion" && /^#RiverPlate/.test(tags.trim())) {
      tags = tagsFallback;
    }
    const fuenteNombre = noticiaElegida.fuente ?? fuente;

    // ── GUARDAR EN DB ─────────────────────────────────────────────────────
    // Siempre guardamos la imagen extraída automáticamente.
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
        publicada: esAutomatico,
        pendiente: !esAutomatico,
        imagenPortada: imagenAutoUrl ?? "",
      })
      .returning();

    // Marcar URL como procesada para no volver a enviarla
    if (noticiaElegida.url) {
      marcarUrlProcesada(noticiaElegida.url, estado);
      guardarEstado(estado);
    }

    // ── ENVIAR A TELEGRAM ─────────────────────────────────────────────────
    const token = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      logger.warn("Scheduler: Telegram no configurado, nota guardada sin enviar");
      return { tipo: "ok", titulo, id: savedNoticia.id, fuente: fuenteNombre };
    }

    const dominioTelegram = process.env.TELEGRAM_WEBHOOK_DOMAIN ?? "riverplateisrael.com";
    const TELEGRAM_MAX = 4096;

    // 🌐 Si se publicó automáticamente, lanzar traducción al hebreo en background
    if (esAutomatico && savedNoticia) {
      traducirYGuardarHebreo(savedNoticia.id).catch(() => {});
    }

    if (esAutomatico) {
      // ── MODO AUTOMÁTICO: FYI solo, ya está publicada ──────────────────
      const fotoTexto = imagenAutoUrl ? "\n🖼 _Foto de portada incluida_" : "\n📷 _Sin foto (podés agregar desde el Redactor)_";
      const etiquetaCat = categoria === "seleccion" ? "🇦🇷 _Categoría: Selección Argentina_\n" : "⚪️🔴 _Categoría: River_\n";
      const mensajeFIY = `✅ *Nota autopublicada en el sitio*\n\n📰 *${titulo}*\n\n${etiquetaCat}📡 _Fuente: ${fuenteNombre}_${fotoTexto}`;
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: mensajeFIY,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              { text: "✏️ Editar en Redactor", url: `https://${dominioTelegram}/redactor` },
            ]],
          },
        }),
      });
      logger.info({ titulo, id: savedNoticia.id, fuente, imagenAutoUrl }, "Scheduler: nota autopublicada con foto automática");
    } else {
      // ── MODO MANUAL: artículo completo + 2 botones ────────────────────
      // Si hay imagen scrapeada, la enviamos primero como sendPhoto
      if (imagenAutoUrl) {
        await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            photo: imagenAutoUrl,
            caption: `🖼 _Foto de portada — ${titulo}_`,
            parse_mode: "Markdown",
          }),
        }).catch(() => { /* no bloquear si falla la foto */ });
      }

      // Foto 1:1 generada por Gemini para Instagram (siempre, además de la scrapeada)
      const imagenIG = await generarImagenIG(titulo, categoria);
      if (imagenIG) {
        try {
          const form = new FormData();
          form.append("chat_id", chatId);
          form.append("caption", `📸 *Foto 1:1 para Instagram*\n_${titulo}_`);
          form.append("parse_mode", "Markdown");
          form.append(
            "photo",
            new Blob([new Uint8Array(imagenIG.buffer)], { type: imagenIG.mimeType }),
            `ig-${savedNoticia.id}.${imagenIG.mimeType.includes("jpeg") ? "jpg" : "png"}`,
          );
          await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
            method: "POST",
            body: form,
          });
          await db
            .update(noticiasTable)
            .set({ imagenInstagram: imagenIG.url })
            .where(eq(noticiasTable.id, savedNoticia.id));
        } catch (err) {
          logger.warn({ err }, "Scheduler: no se pudo mandar foto IG por Telegram");
        }
      }

      // Artículo completo — sin truncar. El contenido redactado cabe dentro de 4096 chars.
      const replyMarkup = {
        inline_keyboard: [[
          { text: "✅ Publicar", callback_data: `publicar_${savedNoticia.id}` },
          { text: "✏️ Editar",  callback_data: `editar_${savedNoticia.id}` },
        ]],
      };

      const etiquetaCatMan = categoria === "seleccion" ? "🇦🇷 _Selección Argentina_\n\n" : "";
      const encabezado = `${etiquetaCatMan}📰 *${titulo}*\n\n`;
      const pie        = `\n\n${tags}\n\n📡 _Fuente: ${fuenteNombre}_`;
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

function msHastaProximaHoraIsrael(horaIsrael: number): number {
  const ahoraUtc = Date.now();
  const offset = israelOffsetHorasInterno(ahoraUtc);
  // Hora actual en Israel
  const ilNowMs = ahoraUtc + offset * 3600_000;
  const ilNow = new Date(ilNowMs);
  // Próximo "horaIsrael":00 en Israel
  const objetivoIl = new Date(Date.UTC(
    ilNow.getUTCFullYear(), ilNow.getUTCMonth(), ilNow.getUTCDate(),
    horaIsrael, 0, 0, 0,
  ));
  if (objetivoIl.getTime() <= ilNowMs) {
    objetivoIl.setUTCDate(objetivoIl.getUTCDate() + 1);
  }
  // Convertir el objetivo (expresado como ms "en Israel") a ms UTC reales
  const objetivoUtcMs = objetivoIl.getTime() - offset * 3600_000;
  return Math.max(1000, objetivoUtcMs - ahoraUtc);
}

export async function enviarResumenHebreoDiario(): Promise<void> {
  if (process.env.RESUMEN_HEBREO_DIARIO === "0") {
    logger.info("Resumen hebreo diario desactivado por RESUMEN_HEBREO_DIARIO=0");
    return;
  }
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    logger.warn("Resumen hebreo diario: Telegram no configurado, saltando");
    return;
  }

  const pendientes = await db
    .select({ id: noticiasTable.id, titulo: noticiasTable.titulo })
    .from(noticiasTable)
    .where(and(
      eq(noticiasTable.hebreoPublicada, false),
      sqlRaw`char_length(coalesce(${noticiasTable.contenidoHe}, '')) > 0`,
    ))
    .orderBy(desc(noticiasTable.id));

  if (pendientes.length === 0) {
    logger.info("Resumen hebreo diario: no hay traducciones pendientes, no se envía mensaje");
    return;
  }

  const dominio = process.env.TELEGRAM_WEBHOOK_DOMAIN ?? "riverplateisrael.com";
  const link = `https://${dominio}/redactor?tab=publicaciones-hebreo`;

  const escape = (s: string) => s.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");

  const MAX_LISTADO = 15;
  const listado = pendientes.slice(0, MAX_LISTADO)
    .map((n) => `• ${escape(n.titulo)}`)
    .join("\n");
  const resto = pendientes.length - MAX_LISTADO;
  const sufijo = resto > 0 ? `\n_…y ${resto} más_` : "";

  const cuerpo =
    `✡ *Resumen diario — traducciones al hebreo pendientes*\n\n` +
    `Hay *${pendientes.length}* ${pendientes.length === 1 ? "traducción" : "traducciones"} en borrador esperando revisión:\n\n` +
    `${listado}${sufijo}\n\n` +
    `[Revisar y publicar en /redactor](${link})`;

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
    logger.warn({ status: res.status, body }, "Resumen hebreo diario: Telegram sendMessage falló");
    return;
  }
  logger.info({ cantidad: pendientes.length }, "Resumen hebreo diario enviado");
}

function iniciarResumenHebreoDiario(): void {
  if (process.env.RESUMEN_HEBREO_DIARIO === "0") {
    logger.info("Resumen hebreo diario desactivado (RESUMEN_HEBREO_DIARIO=0), no se programa");
    return;
  }
  const HORA_ISRAEL = 9;
  const UN_DIA_MS = 24 * 60 * 60 * 1000;
  const delay = msHastaProximaHoraIsrael(HORA_ISRAEL);
  logger.info(
    { horaIsrael: HORA_ISRAEL, minutosHastaPrimerEnvio: Math.round(delay / 60000) },
    "Resumen hebreo diario programado",
  );
  setTimeout(() => {
    enviarResumenHebreoDiario().catch((err) =>
      logger.error({ err }, "Resumen hebreo diario: error inesperado"),
    );
    setInterval(() => {
      enviarResumenHebreoDiario().catch((err) =>
        logger.error({ err }, "Resumen hebreo diario: error inesperado"),
      );
    }, UN_DIA_MS);
  }, delay);
}

// ─── INTERVALO: cada 2 horas ───────────────────────────────────────────────
// Primer ciclo a los 2 minutos de arrancar, luego cada 2 horas exactas.

const INTERVALO_MS   = 2 * 60 * 60 * 1000; // 2 horas
const PRIMER_CICLO_MS =  2 * 60 * 1000; // 2 minutos tras arrancar

export function iniciarScheduler(): void {
  logger.info({ primerCicloMinutos: 2, intervaloHoras: 2 }, "Scheduler automático iniciado — primer ciclo en 2 min, luego cada 2 horas");

  iniciarResumenHebreoDiario();

  setTimeout(() => {
    ejecutarCiclo(undefined, false).catch((err) => logger.error({ err }, "Scheduler: error no capturado en primer ciclo"));

    setInterval(() => {
      ejecutarCiclo(undefined, false).catch((err) => logger.error({ err }, "Scheduler: error no capturado"));
    }, INTERVALO_MS);
  }, PRIMER_CICLO_MS);
}
