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
}

function leerEstado(): SchedulerState {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) as Partial<SchedulerState>;
    return {
      fuenteIndex: typeof raw.fuenteIndex === "number" ? raw.fuenteIndex : 0,
    };
  } catch {
    return { fuenteIndex: 0 };
  }
}

function guardarEstado(estado: SchedulerState): void {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(estado), "utf-8");
  } catch (err) {
    logger.warn({ err }, "Scheduler: no se pudo guardar el estado");
  }
}

// ─── DEDUPLICACIÓN POR DB ─────────────────────────────────────────────────────
// Compara el título candidato con las noticias de los últimos 7 días.
// Si 3 o más palabras significativas (≥4 chars) coinciden → mismo tema → saltar.

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
      .filter(p => p.length >= 4);

    for (const row of res.rows as { titulo: string }[]) {
      const existente = row.titulo
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z\s]/g, "");
      const coincidencias = palabras.filter(p => existente.includes(p));
      if (coincidencias.length >= 3) {
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

VOZ: 70% Juan Pablo Varsky (precisión técnica, terminología táctica, datos concretos) + 30% Azzaro/Yudcovich (mística, sentimiento, el peso de ser del más grande). Vocabulario sagrado: "El Templo del Monumental", "Paladar negro", "La mística de Núñez", "La banda roja que nos cruza el alma", "El Millonario", "El más grande de la Argentina".

═══ ESTRUCTURA OBLIGATORIA ═══

**Título:** [Máximo 10 palabras. Verbo de acción, grandeza evocada. Ej: "Cátedra en Núñez", "Triunfo con Mística", "El Millonario Ordena". NUNCA "River hizo X".]

**Bajada:** [Una oración analítica que captura la esencia. El lector entiende todo sin leer el cuerpo.]

**Contenido:**

[SECCIÓN 1 — EL IMPACTO: Párrafo de apertura potente. No solo el dato: el contexto emocional y deportivo del momento. Qué significa esta noticia en el universo de River hoy. 4-5 oraciones con peso.]

[SECCIÓN 2 — ANÁLISIS TÁCTICO (EL CÓMO): Análisis profundo de la dinámica de juego. Usá terminología específica: basculaciones defensivas, tercer hombre en ataque, amplitud vs profundidad, transiciones defensa-ataque, pressing coordinado, ocupación de espacios, ruptura de líneas, automatismos. Explicá el POR QUÉ táctico detrás del resultado o la situación. 5-6 oraciones.]

[SECCIÓN 3 — COMPARATIVA HISTÓRICA (LA MÍSTICA): Conectá el presente con el pasado glorioso de River. Compará al jugador, al DT o la situación con hitos históricos: La Máquina de los años 40, el River de Labruna, la era de Ramón Díaz, la mística de Gallardo. Datos de archivo concretos que nutran la nota de profundidad histórica. 4-5 oraciones.]

[SECCIÓN 4 — CITAS FUNDAMENTADAS: Incluí declaraciones reales extraídas de la fuente o parafraseadas con rigor periodístico. Analizá cada cita: no la pongas suelta, explicá el peso que tiene en el vestuario, en la dirigencia o en la afición. Qué revela esa declaración sobre el momento del club. 4-5 oraciones.]

[SECCIÓN 5 — INTERPELACIÓN AL HINCHA: Planteá 2-3 preguntas concretas que quedan en el aire. Interrogantes genuinos que el hincha de River se hace: ¿Es este el techo del equipo? ¿Cómo responderá la cantera ante esta exigencia? ¿Puede este plantel pelear en todos los frentes? Formulalas con el tono de quien ama el club y exige excelencia. 3-4 oraciones.]

[SECCIÓN 6 — LA SENTENCIA (CIERRE): Párrafo final contundente. La tesis de toda la nota resumida en una conclusión de Paladar Negro que deje al lector reflexionando. Una sentencia periodística, no un resumen. 3-4 oraciones con fuerza.]

**Tags:** #RiverPlate #RiverIsrael #RamatGan #ElMasGrande [2-3 tags específicos de la noticia]

═══ REGLAS DE HIERRO ═══
1. Mínimo 1848 caracteres y 307 palabras. Sin excepciones.
2. NUNCA copies frases textuales de la fuente. Periodismo de autor, 100% original.
3. NUNCA menciones otros clubes por nombre. River es el único protagonista.
4. Si hay horarios argentinos (ART, UTC-3), convertí sumando 6 horas: "las 21:00 hora israelí".
5. Hashtags siempre al final, nunca dentro del cuerpo del texto.
6. Respetá el formato exacto — el sistema parsea "**Título:**", "**Bajada:**" y "**Tags:**" de forma precisa.`;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function parsearResultado(texto: string): { titulo: string; contenido: string; tags: string } {
  // 1. Intentar extraer título con el marcador explícito **Título:**
  let tituloMatch =
    texto.match(/\*\*Título:\*\*\s*([^\n*][^\n]+)/) ??
    texto.match(/\*\*Título:\*\*\s*\n+\s*([^\n*][^\n]+)/);

  // 2. Fallback: si la IA no puso el marcador, usar la primera línea **negrita** como título
  let tituloEsNegrita = false;
  if (!tituloMatch) {
    const primeraNegraMatch = texto.match(/^\s*\*\*([^*\n]+)\*\*/m);
    if (primeraNegraMatch) {
      tituloMatch = primeraNegraMatch;
      tituloEsNegrita = true;
    }
  }

  const bajadaMatch =
    texto.match(/\*\*Bajada:\*\*\s*([^\n*][^\n]+)/) ??
    texto.match(/\*\*Bajada:\*\*\s*\n+\s*([^\n*][^\n]+)/);
  const tagsMatch =
    texto.match(/\*\*Tags:\*\*\s*([^\n]+)/) ??
    texto.match(/\*\*Tags:\*\*\s*\n+\s*([^\n]+)/);

  const titulo = tituloMatch?.[1]?.trim() ?? "Sin título";
  const bajada = bajadaMatch?.[1]?.trim() ?? "";
  const tags   = tagsMatch?.[1]?.trim() ?? "#RiverPlate #RiverIsrael #RamatGan #ElMasGrande";

  let contenido = texto
    .replace(/\*\*Título:\*\*.*?(\n|$)/gs, "")
    .replace(/\*\*Bajada:\*\*.*?(\n|$)/gs, "")
    .replace(/\*\*Contenido:\*\*\s*\n?/, "")
    .replace(/\*\*Tags:\*\*.*?(\n|$)/gs, "")
    .trim();

  // Si el título vino de la primera negrita, eliminarla del contenido
  if (tituloEsNegrita && titulo !== "Sin título") {
    contenido = contenido.replace(`**${titulo}**`, "").replace(/^\n+/, "").trim();
  }

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

    // ── DEDUPLICACIÓN: saltear temas ya cubiertos ─────────────────────────
    let noticiaElegida: typeof noticias[0] | null = null;

    for (const candidata of noticias) {
      const yaExiste = await tituloYaProcesado(candidata.titulo);
      if (!yaExiste) {
        noticiaElegida = candidata;
        break;
      }
    }

    if (!noticiaElegida) {
      logger.warn({ fuente }, "Scheduler: todos los temas disponibles ya fueron cubiertos esta semana, esperando próximo ciclo");
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

    const resultado = response.text ?? "";
    if (!resultado || resultado.length < 50) {
      logger.error("Scheduler: la IA no generó contenido");
      return;
    }

    logger.info("Scheduler: output AI (primeros 300 chars)", {
      chars: resultado.length,
      preview: resultado.slice(0, 300).replace(/\n/g, "↵"),
    });

    const { titulo, contenido, tags } = parsearResultado(resultado);

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

    const resumen = contenido.slice(0, 600) + (contenido.length > 600 ? "…" : "");

    const mensajeTexto =
      `🚨 *¡NUEVA INFO MILLONARIA DETECTADA!*\n\n` +
      `📰 *${titulo}*\n\n` +
      `${resumen}\n\n` +
      `${tags}\n\n` +
      `📡 _Fuente: ${noticiaElegida.fuente ?? fuente}_`;

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

    logger.info({ titulo, id: savedNoticia.id, fuente }, "Scheduler: ciclo completado correctamente");

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
