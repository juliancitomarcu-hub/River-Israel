import { ai } from "@workspace/integrations-gemini-ai";
import { db } from "@workspace/db";
import { noticiasTable } from "@workspace/db";
import { eq, sql as sqlRaw } from "drizzle-orm";
import * as cheerio from "cheerio";
import { logger } from "./lib/logger";
import * as fs from "fs";
import * as path from "path";

// Fuentes en orden de prioridad — La Página Millonaria y Olé primero
const FUENTES = [
  "pagina", "ole", "tyc",
  "google", "infobae", "clarin", "lanacion",
  "bolavip", "as", "superdeportivo"
] as const;

// ─── ESTADO PERSISTENTE ───────────────────────────────────────────────────────

const STATE_FILE = path.resolve("./scheduler_state.json");

interface SchedulerState {
  fuenteIndex: number;
  urlsProcesadas: string[];  // URLs ya enviadas a Telegram (cap 1000)
}

function leerEstado(): SchedulerState {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) as Partial<SchedulerState>;
    return {
      fuenteIndex:    typeof raw.fuenteIndex === "number" ? raw.fuenteIndex : 0,
      urlsProcesadas: Array.isArray(raw.urlsProcesadas) ? raw.urlsProcesadas : [],
    };
  } catch {
    return { fuenteIndex: 0, urlsProcesadas: [] };
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

// ─── PROMPT MAESTRO: Estructura de Nota de Alto Rendimiento ──────────────────

const PROMPT_MAESTRO = `Sos el Editor Jefe de "River en Israel". Escribís periodismo deportivo de exportación, al nivel de las mejores editoriales de El Gráfico o La Nación Deportes. Cada nota debe tener un mínimo de 1848 caracteres y 307 palabras. Si la noticia original es breve, expandís el análisis táctico y la comparativa histórica hasta alcanzar esa extensión con calidad, sin repetir palabras ni rellenar con frases vacías.

VOZ: 70% Juan Pablo Varsky (precisión técnica, terminología táctica, datos concretos) + 30% Azzaro/Yudcovich (mística, sentimiento, el peso de ser del más grande). Vocabulario sagrado: "**El Templo del Monumental**", "**Paladar negro**", "**La mística de Núñez**", "La banda roja que nos cruza el alma", "**El Millonario**", "El más grande de la Argentina".

═══ ESTRUCTURA OBLIGATORIA (6 SECCIONES, TODAS OBLIGATORIAS) ═══

**Título:** [Máximo 10 palabras. Verbo de acción, grandeza evocada. Ej: "Cátedra en Núñez", "Triunfo con Mística", "El Millonario Ordena". NUNCA "River hizo X".]

**Bajada:** [Una oración analítica que captura la esencia. El lector entiende todo sin leer el cuerpo.]

**Contenido:**

⚽ *EL IMPACTO*
[Párrafo de apertura potente. No solo el dato: el contexto emocional y deportivo del momento. Qué significa esta noticia en el universo de River hoy. Usá **negritas** para los conceptos clave (nombres propios, términos tácticos, fechas importantes). 4-5 oraciones.]

---

🔬 *ANÁLISIS TÁCTICO*
[Análisis profundo de la dinámica de juego. Terminología obligatoria según corresponda: **basculaciones defensivas**, **tercer hombre**, **amplitud vs profundidad**, **transiciones defensa-ataque**, **pressing coordinado**, **ocupación de espacios**, **ruptura de líneas**, **automatismos**. Poneé en negrita los términos tácticos. Explicá el POR QUÉ táctico detrás del resultado o la situación. 5-6 oraciones.]

---

📖 *LA MÍSTICA — COMPARATIVA HISTÓRICA*
[Conectá el presente con el pasado glorioso de River. Compará al jugador, al DT o la situación con hitos históricos: **La Máquina** de los años 40, el River de **Labruna**, la era de **Ramón Díaz**, la mística de **Gallardo**. Datos de archivo concretos. 4-5 oraciones.]

---

🗣️ *CITAS Y CONTEXTO*
[Declaraciones reales de la fuente o parafraseadas con rigor. Analizá cada cita: explicá el peso que tiene en el vestuario, en la dirigencia o en la afición. Qué revela sobre el momento del club. 4-5 oraciones.]

---

❓ *PREGUNTAS QUE QUEDAN EN EL AIRE*
[OBLIGATORIO: exactamente 3 preguntas profundas que el hincha se hace. Empezá cada una con ¿ y terminá con ?. Ejemplos del estilo: ¿Es este el techo del equipo o hay margen para crecer? ¿Cómo responderá la cantera ante esta exigencia? ¿Puede este plantel pelear en todos los frentes sin perder identidad? Formulalas con el tono de quien ama el club y exige excelencia.]

---

🏆 *LA SENTENCIA*
[OBLIGATORIO Y SIEMPRE AL FINAL: Un párrafo contundente de 3-4 oraciones que resuma la tesis de toda la nota. Una conclusión de Paladar Negro al estilo El Gráfico que deje al lector reflexionando. No es un resumen, es una sentencia periodística. IMPORTANTE: esta sección debe completarse SIEMPRE, aunque las anteriores hayan sido extensas. Nunca dejes la nota sin este cierre.]

**Tags:** #RiverPlate #RiverIsrael #RamatGan #ElMasGrande [2-3 tags específicos de la noticia]

═══ REGLAS DE HIERRO ═══
1. Mínimo 1848 caracteres y 307 palabras. Las 6 secciones son TODAS obligatorias.
2. TERMINACIÓN OBLIGATORIA: La nota NUNCA puede quedar cortada a mitad de oración. Si te estás acercando al límite, resumí alguna sección anterior pero completá siempre LA SENTENCIA con un cierre limpio.
3. FORMATO: usá **negritas** para conceptos clave, nombres propios y términos tácticos. Respetá los separadores --- entre secciones y los emojis de encabezado.
4. NUNCA copies frases textuales de la fuente. Periodismo de autor, 100% original.
5. NUNCA menciones otros clubes por nombre. River es el único protagonista.
6. Si hay horarios argentinos (ART, UTC-3), convertí sumando 6 horas: "las 21:00 hora israelí".
7. Hashtags siempre al final, nunca dentro del cuerpo.
8. El sistema parsea "**Título:**", "**Bajada:**" y "**Tags:**" — respetá ese formato exacto.`;

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

async function obtenerTextoArticulo(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    const $ = cheerio.load(html);
    const parrafos = $("article p, .article-body p, .nota-body p, .article__content p, .post-content p, .detail-body p, .entry-content p")
      .map((_: number, el: cheerio.Element) => limpiarTexto($(el).text().trim()))
      .get()
      .filter((t: string) => t.length > 50);
    const texto = parrafos.slice(0, 20).join("\n\n");
    return texto.length > 200 ? texto : "";
  } catch {
    return "";
  }
}

// ─── FLAG ANTI-CONCURRENCIA ───────────────────────────────────────────────────
let enEjecucion = false;

async function ejecutarCiclo(fuenteOverride?: string): Promise<void> {
  if (enEjecucion) {
    logger.warn("Scheduler: ciclo anterior aún en ejecución, saltando este turno");
    return;
  }
  enEjecucion = true;

  try {
    const estado = leerEstado();
    const fuente = fuenteOverride ?? FUENTES[estado.fuenteIndex % FUENTES.length];

    if (!fuenteOverride) {
      estado.fuenteIndex += 1;
      guardarEstado(estado);
    }

    logger.info({ fuente, siguiente: FUENTES[estado.fuenteIndex % FUENTES.length] }, "Scheduler: iniciando ciclo automático");

    const port = process.env.PORT;
    const noticiasRes = await fetch(`http://localhost:${port}/api/noticias-river?fuente=${fuente}`, {
      signal: AbortSignal.timeout(35000),
    });

    if (!noticiasRes.ok) {
      logger.warn({ fuente, status: noticiasRes.status }, "Scheduler: scraping falló");
      return;
    }

    const data = await noticiasRes.json() as { noticias?: { titulo: string; url: string; fuente: string }[] };
    const noticias = data.noticias ?? [];

    if (!noticias.length) {
      logger.warn({ fuente }, "Scheduler: no se encontraron noticias");
      return;
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
      logger.warn({ fuente }, "Scheduler: todas las noticias disponibles ya fueron procesadas o son antiguas, esperando próximo ciclo");
      return;
    }

    logger.info({ titulo: noticiaElegida.titulo, url: noticiaElegida.url }, "Scheduler: noticia seleccionada");

    // ── EXTRAER TEXTO DEL ARTÍCULO ────────────────────────────────────────
    let textoParaIA = noticiaElegida.titulo;
    if (noticiaElegida.url) {
      const textoArticulo = await obtenerTextoArticulo(noticiaElegida.url);
      if (textoArticulo) {
        textoParaIA = `${noticiaElegida.titulo}\n\n${textoArticulo}`;
      }
    }

    // ── GENERAR CON IA (Gemini Flash) ─────────────────────────────────────
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: `Transformá esta noticia para el sitio River en Israel:\n\n${textoParaIA}` }] }],
      config: {
        systemInstruction: PROMPT_MAESTRO,
        maxOutputTokens: 3000,
      },
    });

    let resultado = response.text ?? "";
    if (!resultado || resultado.length < 50) {
      logger.error("Scheduler: la IA no generó contenido");
      return;
    }

    logger.info("Scheduler: output AI inicial", {
      chars: resultado.length,
      preview: resultado.slice(0, 200).replace(/\n/g, "↵"),
    });

    // ── CONTROL DE CALIDAD PRE-GUARDADO ───────────────────────────────────
    // Si la nota es demasiado corta o termina cortada, pedimos expansión (1 intento)
    let parsed = parsearResultado(resultado);
    const MINIMO_CHARS = 1848;
    const cortada = /[…\.]{3,}\s*$/.test(parsed.contenido.trimEnd());
    const corta   = parsed.contenido.length < MINIMO_CHARS;

    if (corta || cortada) {
      logger.warn("Scheduler: nota insuficiente, solicitando expansión a la IA", {
        chars: parsed.contenido.length,
        cortada,
      });
      const expansion = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: "user",  parts: [{ text: `Transformá esta noticia para el sitio River en Israel:\n\n${textoParaIA}` }] },
          { role: "model", parts: [{ text: resultado }] },
          { role: "user",  parts: [{ text: "La nota está incompleta o es demasiado corta. Continuá desde donde se cortó: expandí el Análisis Táctico y la Comparativa Histórica, asegurate de incluir las 3 PREGUNTAS (❓ PREGUNTAS QUE QUEDAN EN EL AIRE) y terminá con el párrafo 🏆 LA SENTENCIA completo. La última palabra debe ser punto final, nunca puntos suspensivos." }] },
        ],
        config: { systemInstruction: PROMPT_MAESTRO, maxOutputTokens: 3000 },
      });
      const resultadoExpandido = expansion.text ?? "";
      if (resultadoExpandido && resultadoExpandido.length > resultado.length) {
        resultado = resultadoExpandido;
        parsed = parsearResultado(resultado);
        logger.info("Scheduler: expansión aplicada", { chars: parsed.contenido.length });
      }
    }

    const { titulo, contenido, tags } = parsed;

    const [savedNoticia] = await db
      .insert(noticiasTable)
      .values({
        titulo,
        contenido,
        tags,
        textoOriginal: textoParaIA.slice(0, 3000),
        fuente: noticiaElegida.fuente ?? fuente,
        publicada: false,
        pendiente: true,
        imagenPortada: "",
      })
      .returning();

    // ── ENVIAR A TELEGRAM ─────────────────────────────────────────────────
    const token = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      logger.warn("Scheduler: Telegram no configurado, nota guardada sin enviar");
      return;
    }

    const replyMarkup = {
      inline_keyboard: [[
        { text: "✅ Publicar",      callback_data: `publicar_${savedNoticia.id}` },
        { text: "✏️ Editar",        callback_data: `editar_${savedNoticia.id}` },
        { text: "📸 Foto",          callback_data: `foto_${savedNoticia.id}` },
        { text: "❌ Rechazar",      callback_data: `rechazar_${savedNoticia.id}` },
      ]],
    };

    // Texto completo sin recortar — Telegram admite hasta 4096 chars en sendMessage
    const TELEGRAM_MAX = 4096;
    const encabezado = `🚨 *¡NUEVA INFO MILLONARIA DETECTADA!*\n\n📰 *${titulo}*\n\n`;
    const pie        = `\n\n${tags}\n\n📡 _Fuente: ${noticiaElegida.fuente ?? fuente}_`;
    const maxCuerpo  = TELEGRAM_MAX - encabezado.length - pie.length - 5;
    const cuerpo     = contenido.length > maxCuerpo ? contenido.slice(0, maxCuerpo) + "…" : contenido;

    const mensajeTexto = encabezado + cuerpo + pie;

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: mensajeTexto, parse_mode: "Markdown", reply_markup: replyMarkup }),
    });

    const tgData = await tgRes.json() as { ok: boolean; result?: { message_id: number } };

    if (!tgRes.ok || !tgData.ok) {
      logger.error({ tgData }, "Scheduler: error enviando a Telegram");
      return;
    }

    const messageId = String(tgData.result?.message_id ?? "");
    if (messageId) {
      await db
        .update(noticiasTable)
        .set({ telegramMessageId: messageId })
        .where(eq(noticiasTable.id, savedNoticia.id));
    }

    // Marcar URL como procesada para no volver a enviarla aunque aparezca en scraping futuro
    if (noticiaElegida.url) {
      marcarUrlProcesada(noticiaElegida.url, estado);
      guardarEstado(estado);
    }

    logger.info({ titulo, id: savedNoticia.id, fuente, url: noticiaElegida.url }, "Scheduler: ciclo completado correctamente");

  } catch (err) {
    logger.error({ err }, "Scheduler: error inesperado en ciclo automático");
  } finally {
    enEjecucion = false;
  }
}

export { ejecutarCiclo };

// ─── INTERVALO: cada 15 minutos ───────────────────────────────────────────────
// Primer ciclo a los 2 minutos de arrancar, luego cada 15 minutos exactos.

const INTERVALO_MS   = 15 * 60 * 1000; // 15 minutos
const PRIMER_CICLO_MS =  2 * 60 * 1000; // 2 minutos tras arrancar

export function iniciarScheduler(): void {
  logger.info({ primerCicloMinutos: 2, intervaloMinutos: 15 }, "Scheduler automático iniciado — primer ciclo en 2 min, luego cada 15 minutos");

  setTimeout(() => {
    ejecutarCiclo().catch((err) => logger.error({ err }, "Scheduler: error no capturado en primer ciclo"));

    setInterval(() => {
      ejecutarCiclo().catch((err) => logger.error({ err }, "Scheduler: error no capturado"));
    }, INTERVALO_MS);
  }, PRIMER_CICLO_MS);
}
