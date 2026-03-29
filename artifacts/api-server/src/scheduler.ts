import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { noticiasTable } from "@workspace/db";
import { eq, sql as sqlRaw } from "drizzle-orm";
import * as cheerio from "cheerio";
import { logger } from "./lib/logger";
import * as fs from "fs";
import * as path from "path";

const FUENTES = ["google", "tyc", "ole", "infobae", "clarin", "lanacion", "bolavip", "as", "superdeportivo"] as const;

// ─── ESTADO PERSISTENTE ──────────────────────────────────────────────────────
// Solo guarda el índice de fuente. La deduplicación se hace contra la DB.

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
// Esto funciona aunque el servidor se reinicie o se redeploy (usa la DB, no archivos).

async function tituloYaProcesado(titulo: string): Promise<boolean> {
  try {
    const res = await db.execute(sqlRaw`
      SELECT titulo FROM noticias
      WHERE created_at > NOW() - INTERVAL '7 days'
    `);

    const palabras = titulo
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // quitar tildes
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

// ─── PROMPT ──────────────────────────────────────────────────────────────────

const PROMPT_MAESTRO = `Rol: Sos el Editor Jefe de "River en Israel". Tu identidad es una fusión entre Juan Pablo Varsky (análisis táctico, conceptos del juego, narrativa profunda) y Miguel Simon (rigor estadístico, precisión técnica, datos duros). Escribís para la comunidad de hinchas de River Plate en Israel — específicamente la Filial Ramat Gan — que exige periodismo de élite, no titulares vacíos.

ESTILO DE REDACCIÓN:
- Análisis táctico: Hablá de automatismos, gestión de espacios, transiciones, bloque bajo, sociedades en el campo, pressing, línea defensiva. No te quedés en "jugó bien".
- Rigor estadístico: Si la noticia involucra un jugador, aportá datos de su historial (goles, partidos, temporadas). Usá números concretos cuando los haya.
- Cero copyright: Leé los hechos de la fuente y redactá un artículo 100% original con tus propias palabras. Prohibido copiar frases de Olé, TyC, Infobae o cualquier otro medio. Esto es periodismo de autor.
- Tono: Elegante, analítico, profesional. Nunca panfletario ni de "hincha termo".
- Conversión horaria: Si se menciona un horario en Argentina (ART, UTC-3), calculá el horario israelí sumando 6 horas e integralo naturalmente en el texto.
- Cierre obligatorio: El último párrafo debe incluir una referencia breve y auténtica a cómo se vive esta noticia desde Israel, desde la Filial Ramat Gan. No como publicidad — como cierre periodístico con perspectiva local.

FORMATO DE SALIDA (obligatorio, sin variaciones):

**Título:** [Impactante y analítico — máximo 12 palabras]

**Bajada:** [Resumen de 1-2 líneas con los datos clave de la noticia]

**Contenido:**
[Párrafo de introducción — engancha al lector, plantea el núcleo sin rodeos]

[Párrafo de desarrollo — antecedentes, contexto, declaraciones si las hay]

[Párrafo de análisis táctico/estadístico — qué significa para el equipo, datos concretos]

[Párrafo de cierre — qué sigue, qué está en juego, perspectiva desde Israel/Filial Ramat Gan]

**Tags:** #RiverPlate #RiverIsrael #RamatGan #AnalisisMillonario [otros tags relevantes]`;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function parsearResultado(texto: string): { titulo: string; contenido: string; tags: string } {
  const tituloMatch = texto.match(/\*\*Título:\*\*\s*(.+)/);
  const bajadaMatch = texto.match(/\*\*Bajada:\*\*\s*(.+)/);
  const tagsMatch   = texto.match(/\*\*Tags:\*\*\s*(.+)/);

  const titulo = tituloMatch?.[1]?.trim() ?? "Sin título";
  const bajada = bajadaMatch?.[1]?.trim() ?? "";
  const tags   = tagsMatch?.[1]?.trim() ?? "#RiverPlate #RiverIsrael #RamatGan #AnalisisMillonario";

  let contenido = texto
    .replace(/\*\*Título:\*\*\s*.+\n?/, "")
    .replace(/\*\*Bajada:\*\*\s*.+\n?/, "")
    .replace(/\*\*Contenido:\*\*\s*\n?/, "")
    .replace(/\*\*Tags:\*\*\s*.+\n?/, "")
    .trim();

  // Prepender la bajada en cursiva como primer párrafo si existe
  if (bajada) {
    contenido = `*${bajada}*\n\n${contenido}`;
  }

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

    // ── DEDUPLICACIÓN POR DB: saltear temas ya cubiertos ────────────────────
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
