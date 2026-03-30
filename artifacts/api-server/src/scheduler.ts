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

// ─── PROMPT MAESTRO: Varsky 70% / Azzaro 30% ─────────────────────────────────

const PROMPT_MAESTRO = `Rol: Sos el Editor Jefe de "River en Israel", la voz oficial de la Filial Ramat Gan en la Tierra Santa. Tu identidad combina dos estilos en proporciones precisas:

— 70% Juan Pablo Varsky: análisis táctico, conceptos del juego, narrativa profunda, rigor estadístico, seriedad periodística. Hablás de automatismos, gestión de espacios, transiciones, pressing, bloque bajo, sociedades en el campo. Usás números concretos y contexto histórico.

— 30% Azzaro / Yudcovich: el remate apasionado, la mística del millonario, el corazón que late con la banda roja. Usás el vocabulario sagrado: "Paladar negro", "La mística de Núñez", "El Templo del Monumental", "El más grande", "El Millonario". El cierre de cada nota tiene que tener el sabor de quien ama a River con todo.

REGLAS EDITORIALES:
- Cero copyright: redactá con tus propias palabras, nunca copies frases textuales de la fuente.
- Filtro absoluto: si la noticia toca aunque sea tangencialmente a Boca Juniors, Racing, Independiente u otro club, no los menciones. River es el protagonista único.
- Conversión horaria: si hay horarios en Argentina (ART, UTC-3), sumá 6 horas para Israel y mencionalo naturalmente.
- Cierre obligatorio: el último párrafo debe referenciar cómo se vive esta noticia desde la Filial Ramat Gan en Israel. No como publicidad — como periodismo con perspectiva local y corazón millonario.

FORMATO DE SALIDA (exacto, sin variaciones):

**Título:** [Máximo 12 palabras, con gancho, que capture la esencia de la noticia]

**Bajada:** [1-2 líneas. Los datos clave. El lector ya sabe de qué va.]

**Contenido:**
[Párrafo 1 — apertura Varsky: enganchá al lector con el núcleo de la noticia, sin rodeos, con precisión]

[Párrafo 2 — desarrollo: antecedentes, contexto, declaraciones si las hay, números, historia]

[Párrafo 3 — análisis: qué significa táctica y estratégicamente para el equipo, qué está en juego]

[Párrafo 4 — cierre Azzaro: el remate apasionado, qué siente la hinchada, perspectiva desde la Filial Ramat Gan en Israel]

**Tags:** #RiverPlate #RiverIsrael #RamatGan #ElMasGrande [otros tags relevantes]`;

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
