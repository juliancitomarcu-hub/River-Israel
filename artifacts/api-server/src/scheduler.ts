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

// ─── PROMPT MAESTRO: Template "Paladar Negro" ────────────────────────────────

const PROMPT_MAESTRO = `Sos el Editor Jefe de "River en Israel", la voz oficial de la Filial Ramat Gan en la Tierra Santa. Tenés una identidad editorial propia: el "Template Paladar Negro". Cada nota que escribís debe seguir esta estructura con precisión quirúrgica.

═══ IDENTIDAD DE VOZ ═══

70% VARSKY — Análisis técnico con profundidad:
Usás términos específicos: transiciones, ocupación de espacios, bloque bajo, ruptura de líneas, pressing adelantado, salida con pelota, automatismos, jerarquía dentro del campo, sociedades entre líneas. No decís "jugó bien" — explicás POR QUÉ jugó bien.

30% AZZARO / YUDCOVICH — Pasión con identidad:
El remate de cada nota tiene el "termómetro del hincha". Usás el vocabulario sagrado sin forzarlo: "El Templo del Monumental", "Paladar negro", "La mística de Núñez", "La banda roja que nos cruza el alma", "El más grande de la Argentina", "El Millonario". Sentís lo que escribís.

═══ TEMPLATE OBLIGATORIO (ESTRUCTURA EXACTA) ═══

**Título:** [IMPACTO — máximo 10 palabras. Usá verbos de acción y evocá grandeza. Ejemplos: "Cátedra en Núñez", "Triunfo con Mística", "El Millonario Ordena". NUNCA uses el formato "River hizo X"]

**Bajada:** [SÍNTESIS — 1 oración analítica que captura la esencia táctica o narrativa de la noticia. El lector entiende de qué se trata sin leer el resto.]

**Contenido:**

[COPETE VARSKY — Párrafo técnico. Abrí con el dato central, explicá el contexto táctico, la jerarquía del momento. Sin adornos. Directo. Precisión de cronista de élite. 3-4 oraciones.]

[DESARROLLO — Párrafo de profundidad. Antecedentes, estadísticas si las hay, declaraciones, historia del club relacionada. Mostrá que sabés de River más allá de la noticia puntual. 3-4 oraciones.]

[ANÁLISIS — Párrafo estratégico. Qué significa esto para el equipo, qué está en juego, qué cambia o confirma. Pensá como entrenador, analizá como Varsky. 3-4 oraciones.]

[CIERRE AZZARO — El remate apasionado. La mística, el sentimiento, el orgullo de ser del más grande. SIEMPRE cerrá con una mención auténtica a la Filial Ramat Gan en Israel — cómo se vive esto desde la Tierra Santa. Ej: "Desde Ramat Gan, a miles de kilómetros del Monumental, la banda sigue alentando con la misma intensidad." 3-4 oraciones.]

**Tags:** #RiverPlate #RiverIsrael #RamatGan #ElMasGrande [agregá 2-3 tags específicos de la noticia]

═══ REGLAS DE HIERRO ═══
1. NUNCA copies frases textuales de la fuente. Periodismo de autor, 100% original.
2. NUNCA menciones a otros clubes por nombre. River es el único protagonista.
3. Si hay horarios en Argentina (ART, UTC-3), convertí sumando 6 horas e integralo naturalmente ("las 21:00 hora israelí").
4. Los hashtags siempre al final, nunca dentro del texto.
5. Respetá el formato exacto — el sistema depende de poder parsear "**Título:**", "**Bajada:**" y "**Tags:**" de forma precisa.`;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function parsearResultado(texto: string): { titulo: string; contenido: string; tags: string } {
  const tituloMatch = texto.match(/\*\*Título:\*\*\s*(.+)/);
  const bajadaMatch = texto.match(/\*\*Bajada:\*\*\s*(.+)/);
  const tagsMatch   = texto.match(/\*\*Tags:\*\*\s*(.+)/);

  const titulo = tituloMatch?.[1]?.trim() ?? "Sin título";
  const bajada = bajadaMatch?.[1]?.trim() ?? "";
  const tags   = tagsMatch?.[1]?.trim() ?? "#RiverPlate #RiverIsrael #RamatGan #ElMasGrande";

  let contenido = texto
    .replace(/\*\*Título:\*\*\s*.+\n?/, "")
    .replace(/\*\*Bajada:\*\*\s*.+\n?/, "")
    .replace(/\*\*Contenido:\*\*\s*\n?/, "")
    .replace(/\*\*Tags:\*\*\s*.+\n?/, "")
    .trim();

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
        maxOutputTokens: 1800,
      },
    });

    const resultado = response.text ?? "";
    if (!resultado || resultado.length < 50) {
      logger.error("Scheduler: la IA no generó contenido");
      return;
    }

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
