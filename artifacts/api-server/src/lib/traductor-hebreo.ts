import { GoogleGenAI } from "@google/genai";
import { db, noticiasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

const PROMPT_TRADUCCION = `Sos traductor profesional español → hebreo moderno, con nivel y rigor de la Universidad Hebrea de Jerusalén y de la Academia de la Lengua Hebrea (האקדמיה ללשון העברית).

Tarea: traducir un artículo periodístico de fútbol (Club Atlético River Plate) al hebreo moderno actual, gramática perfecta, ortografía impecable, estilo periodístico israelí natural y fluido — como El País deportes pero en hebreo.

Reglas estrictas:
1. **PROHIBIDO USAR נְקֻדּוֹת (NIQQUD / vocalización)**. Bajo ninguna circunstancia uses diacríticos vocálicos hebreos (קָמַץ, פַּתַח, חִירִיק, צֵירֵי, סֶגוֹל, חוֹלָם, שׁוּרוּק, שְׁוָא, dagesh, etc.) ni signos cantilatorios. Solo letras planas del hebreo moderno (כתיב מלא, ktiv malé) — exactamente como escribe Ynet, Haaretz o Walla. Nunca uses caracteres Unicode del rango U+0591–U+05C7.
2. **Ortografía impecable** (כתיב מלא moderno oficial de la Academia): yod y vav plenas donde corresponde. Revisá cada palabra antes de devolverla. Sin errores tipográficos. Sin transliteraciones inventadas: usá las grafías estándar del periodismo deportivo israelí.
3. Nombres propios de jugadores, técnicos, clubes y lugares: transliterar al hebreo con la convención periodística israelí estándar, SIN niqqud.
   - "River Plate" → "ריבר פלאטה"
   - "Eduardo Coudet" / "El Chacho" → "אדוארדו קודה" / "אל צ׳אצ׳ו"
   - "Marcelo Gallardo" → "מרסלו גאיארדו"
   - "Monumental" → "מונומנטל"
   - "Núñez" → "נוניס"
   - "Buenos Aires" → "בואנוס איירס"
   - "Ramat Gan" → "רמת גן"
   - "Filial" → "סניף"
   - "Superclásico" → "סופרקלאסיקו"
   - "Copa Libertadores" → "קופה ליברטדורס"
4. Mantené la estructura: bajada en negrita al inicio (con *asteriscos*), después párrafos.
5. NO inventes información ni cambies hechos. Traducción literal del sentido, idiomática del idioma.
6. Hashtags: traducidos al hebreo, sin niqqud.

Devolvé EXACTAMENTE en este formato (sin agregar comentarios, sin texto antes/después):

**Título:**
[título en hebreo]

**Contenido:**
[contenido completo en hebreo, párrafos preservados, bajada con *asteriscos* al inicio]

**Tags:**
#ריברפלאטה #ריברישראל #רמתגן #הגדולמכולם`;

export async function traducirAHebreo(input: {
  titulo: string;
  contenido: string;
  tags: string;
}): Promise<{ tituloHe: string; contenidoHe: string; tagsHe: string } | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text:
        `**Título:** ${input.titulo}\n\n**Contenido:** ${input.contenido}\n\n**Tags:** ${input.tags}`
      }] }],
      config: { systemInstruction: PROMPT_TRADUCCION, maxOutputTokens: 6000 },
    });
    const texto = response.text ?? "";
    if (!texto || texto.length < 50) {
      logger.warn({ len: texto.length }, "Traductor hebreo: respuesta vacía o muy corta");
      return null;
    }

    const mTit = texto.match(/\*\*Título:\*\*\s*([\s\S]+?)\n\s*\*\*Contenido:\*\*/);
    const mCon = texto.match(/\*\*Contenido:\*\*\s*([\s\S]+?)\n\s*\*\*Tags:\*\*/);
    const mTag = texto.match(/\*\*Tags:\*\*\s*([\s\S]+?)$/);

    if (!mTit || !mCon) {
      logger.warn({ preview: texto.slice(0, 200) }, "Traductor hebreo: formato no parseable");
      return null;
    }

    // Seguridad extra: eliminar cualquier niqqud / cantilación que se haya colado
    const stripNiqqud = (s: string) => s.replace(/[\u0591-\u05C7]/g, "");

    return {
      tituloHe: stripNiqqud(mTit[1].trim()),
      contenidoHe: stripNiqqud(mCon[1].trim()),
      tagsHe: stripNiqqud((mTag?.[1] ?? "#ריברפלאטה #ריברישראל #רמתגן #הגדולמכולם").trim()),
    };
  } catch (err) {
    logger.error({ err }, "Traductor hebreo: error en Gemini");
    return null;
  }
}

/**
 * Traduce una noticia al hebreo y la guarda en la DB.
 * Pensado para ejecutarse fire-and-forget tras publicar.
 * Si ya tiene traducción (>100 chars), no la pisa.
 */
export async function traducirYGuardarHebreo(
  noticiaId: number,
  opts: { force?: boolean } = {},
): Promise<void> {
  try {
    const [noticia] = await db.select().from(noticiasTable).where(eq(noticiasTable.id, noticiaId));
    if (!noticia) return;
    if (!opts.force && noticia.contenidoHe && noticia.contenidoHe.length > 100) {
      logger.info({ id: noticiaId }, "Noticia ya traducida al hebreo, salteando");
      return;
    }

    const traduccion = await traducirAHebreo({
      titulo: noticia.titulo,
      contenido: noticia.contenido,
      tags: noticia.tags,
    });
    if (!traduccion) {
      logger.warn({ id: noticiaId }, "No se pudo traducir noticia al hebreo");
      return;
    }

    await db.update(noticiasTable).set({ ...traduccion, hebreoPublicada: false }).where(eq(noticiasTable.id, noticiaId));
    logger.info({ id: noticiaId, tituloHe: traduccion.tituloHe }, "✡ Traducción hebrea guardada");

    await avisarTraduccionBorrador({
      tituloEs: noticia.titulo,
      tituloHe: traduccion.tituloHe,
    }).catch((err) => logger.warn({ err, noticiaId }, "Aviso Telegram traducción hebrea falló"));
  } catch (err) {
    logger.error({ err, noticiaId }, "Error en traducirYGuardarHebreo");
  }
}

/**
 * Avisa por Telegram al admin que una traducción al hebreo quedó en borrador
 * esperando revisión en /redactor (tab "Publicaciones en Hebreo").
 *
 * Se puede desactivar seteando AVISAR_HEBREO_BORRADOR=0.
 */
async function avisarTraduccionBorrador(input: {
  tituloEs: string;
  tituloHe: string;
}): Promise<void> {
  if (process.env.AVISAR_HEBREO_BORRADOR === "0") return;

  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const dominio = process.env.TELEGRAM_WEBHOOK_DOMAIN ?? "riverplateisrael.com";
  const link = `https://${dominio}/redactor?tab=publicaciones-hebreo`;

  const escape = (s: string) =>
    s.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");

  const texto =
    "✡ *Nueva traducción al hebreo en borrador*\n\n" +
    `🇪🇸 ${escape(input.tituloEs)}\n` +
    `🇮🇱 ${escape(input.tituloHe)}\n\n` +
    `[Revisar y publicar en /redactor](${link})`;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: texto,
      parse_mode: "MarkdownV2",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.warn({ status: res.status, body }, "Telegram sendMessage falló (aviso hebreo)");
  }
}
