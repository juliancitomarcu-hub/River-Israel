import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { noticiasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import * as cheerio from "cheerio";
import { logger } from "./lib/logger";
import * as fs from "fs";
import * as path from "path";

const FUENTES = ["tyc", "ole", "infobae", "clarin", "lanacion", "bolavip", "as", "superdeportivo"] as const;

// ─── ESTADO PERSISTENTE ──────────────────────────────────────────────────────
// Sobrevive reinicios del servidor. Guarda el índice de fuente y las URLs ya
// procesadas (para evitar repetir noticias aunque el servidor se reinicie).

const STATE_FILE = path.resolve("./scheduler_state.json");
const MAX_URLS_GUARDADAS = 500;

interface SchedulerState {
  fuenteIndex: number;
  urlsProcesadas: string[];
}

function leerEstado(): SchedulerState {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) as Partial<SchedulerState>;
    return {
      fuenteIndex: typeof raw.fuenteIndex === "number" ? raw.fuenteIndex : 0,
      urlsProcesadas: Array.isArray(raw.urlsProcesadas) ? raw.urlsProcesadas : [],
    };
  } catch {
    return { fuenteIndex: 0, urlsProcesadas: [] };
  }
}

function guardarEstado(estado: SchedulerState): void {
  try {
    // Mantener solo las últimas MAX_URLS_GUARDADAS para no crecer indefinidamente
    const urlsLimitadas = estado.urlsProcesadas.slice(-MAX_URLS_GUARDADAS);
    fs.writeFileSync(STATE_FILE, JSON.stringify({ ...estado, urlsProcesadas: urlsLimitadas }), "utf-8");
  } catch (err) {
    logger.warn({ err }, "Scheduler: no se pudo guardar el estado");
  }
}

// ─── PROMPT ──────────────────────────────────────────────────────────────────

const PROMPT_MAESTRO = `Rol: Sos un periodista deportivo argentino de primer nivel, con el estilo narrativo de Juan Pablo Varsky y la profundidad analítica de los grandes referentes del periodismo de River Plate. Escribís para "River en Israel", el sitio web de la comunidad riverplatense en Israel. Tu trabajo es reescribir noticias de River Plate con calidad periodística real.

ESTILO DE ESCRITURA:
- Voz: Periodística, precisa, con peso narrativo. Cada palabra importa. Evitá muletillas, lugares comunes y frases hechas.
- Titular: Debe generar impacto y curiosidad inmediata. No más de 12 palabras. Sin signos de exclamación forzados. El título debe decir algo, no adornar.
- Cuerpo de la nota: Mínimo 4 párrafos sólidos. Cada párrafo agrega información nueva, contexto o análisis.
- Introducción: El primer párrafo engancha al lector de inmediato. Plantea el núcleo de la historia sin rodeos.
- Desarrollo: Ampliá con antecedentes, cifras, contexto histórico, declaraciones (si las hay en la fuente) y análisis de lo que significa para el equipo.
- Usá viñetas (•) solo cuando sea útil para datos concretos.
- Si la noticia menciona un horario de partido en Argentina (ART, UTC-3), calculá el horario israelí sumando 6 horas.
- Tono: Serio y periodístico. Nunca panfletario ni de hinchada.
- PROHIBIDO: No agregues ningún llamado a unirse a la filial, al grupo de WhatsApp ni a ninguna comunidad. La nota termina periodísticamente.

FORMATO DE SALIDA (obligatorio, sin variaciones):

**Título:** [Título periodístico de impacto]

**Contenido:**
[Párrafo de introducción]

[Párrafo de desarrollo/contexto]

[Párrafo de análisis o datos relevantes]

[Párrafo de cierre periodístico — qué sigue, qué está en juego]

**Tags:** #RiverPlate [otros tags relevantes según la noticia]`;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function parsearResultado(texto: string): { titulo: string; contenido: string; tags: string } {
  const tituloMatch = texto.match(/\*\*Título:\*\*\s*(.+)/);
  const tagsMatch = texto.match(/\*\*Tags:\*\*\s*(.+)/);
  const titulo = tituloMatch?.[1]?.trim() ?? "Sin título";
  const tags = tagsMatch?.[1]?.trim() ?? "#RiverPlate #RiverIsrael";
  const contenido = texto
    .replace(/\*\*Título:\*\*\s*.+\n?/, "")
    .replace(/\*\*Contenido:\*\*\s*\n?/, "")
    .replace(/\*\*Tags:\*\*\s*.+\n?/, "")
    .trim();
  return { titulo, contenido, tags };
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
    const parrafos = $("article p, .article-body p, .nota-body p, .article__content p, .post-content p, .detail-body p")
      .map((_: number, el: cheerio.Element) => $(el).text().trim())
      .get()
      .filter((t: string) => t.length > 50);
    const texto = parrafos.slice(0, 20).join("\n\n");
    return texto.length > 200 ? texto : "";
  } catch {
    return "";
  }
}

// ─── FLAG ANTI-CONCURRENCIA ───────────────────────────────────────────────────
// Evita que dos ciclos corran al mismo tiempo si el anterior tardó demasiado.
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

    // ── DEDUPLICACIÓN: saltear URLs ya procesadas ────────────────────────────
    // Leemos estado fresco (puede haber cambiado si fuenteOverride lo actualizó)
    const estadoFresco = leerEstado();
    let noticiaElegida: typeof noticias[0] | null = null;

    for (const candidata of noticias) {
      const urlKey = candidata.url || candidata.titulo;
      if (!estadoFresco.urlsProcesadas.includes(urlKey)) {
        noticiaElegida = candidata;
        break;
      }
      logger.info({ url: urlKey }, "Scheduler: noticia ya procesada, saltando");
    }

    if (!noticiaElegida) {
      logger.warn({ fuente }, "Scheduler: todas las noticias disponibles ya fueron procesadas, esperando próximo ciclo");
      return;
    }

    logger.info({ titulo: noticiaElegida.titulo, url: noticiaElegida.url }, "Scheduler: noticia seleccionada");

    // Marcar URL como procesada ANTES de generar (evita reintento doble si la IA falla)
    estadoFresco.urlsProcesadas.push(noticiaElegida.url || noticiaElegida.titulo);
    guardarEstado(estadoFresco);

    // ── EXTRAER TEXTO DEL ARTÍCULO ───────────────────────────────────────────
    let textoParaIA = noticiaElegida.titulo;
    if (noticiaElegida.url) {
      const textoArticulo = await obtenerTextoArticulo(noticiaElegida.url);
      if (textoArticulo) {
        textoParaIA = `${noticiaElegida.titulo}\n\n${textoArticulo}`;
      }
    }

    // ── GENERAR CON IA (gpt-4o-mini: más rápido, mismo resultado) ────────────
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1800,
      messages: [
        { role: "system", content: PROMPT_MAESTRO },
        { role: "user", content: `Transformá esta noticia para el sitio River en Israel:\n\n${textoParaIA}` },
      ],
    });

    const resultado = completion.choices[0]?.message?.content ?? "";
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

    // ── ENVIAR A TELEGRAM ────────────────────────────────────────────────────
    const token = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      logger.warn("Scheduler: Telegram no configurado, nota guardada sin enviar");
      return;
    }

    const replyMarkup = {
      inline_keyboard: [[
        { text: "✅ Publicar", callback_data: `publicar_${savedNoticia.id}` },
        { text: "✏️ Editar + foto", callback_data: `editar_${savedNoticia.id}` },
        { text: "❌ Rechazar", callback_data: `rechazar_${savedNoticia.id}` },
      ]],
    };

    const mensajeTexto =
      `🤖 *AUTO — River en Israel*\n\n` +
      `📰 *${titulo}*\n\n` +
      `${contenido.slice(0, 700)}${contenido.length > 700 ? "..." : ""}\n\n` +
      `${tags}\n\n` +
      `_Usá ✏️ para agregar foto antes de publicar_`;

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

// ─── INTERVALO: cada 2 horas exactas ─────────────────────────────────────────
// Usamos setInterval (más preciso que setTimeout recursivo) con un primer ciclo
// retrasado 5 minutos para darle tiempo al servidor de arrancar correctamente.

const INTERVALO_MS  = 2 * 60 * 60 * 1000; // 2 horas
const PRIMER_CICLO_MS = 5 * 60 * 1000;    // 5 minutos tras arrancar

export function iniciarScheduler(): void {
  logger.info({ primerCicloMinutos: 5, intervalHoras: 2 }, "Scheduler automático iniciado — primer ciclo en 5 min, luego cada 2 horas");

  // Primer ciclo: espera 5 minutos y luego dispara el intervalo regular
  setTimeout(() => {
    ejecutarCiclo().catch((err) => logger.error({ err }, "Scheduler: error no capturado en primer ciclo"));

    // A partir del primer ciclo, corre exactamente cada 2 horas
    setInterval(() => {
      ejecutarCiclo().catch((err) => logger.error({ err }, "Scheduler: error no capturado"));
    }, INTERVALO_MS);
  }, PRIMER_CICLO_MS);
}
