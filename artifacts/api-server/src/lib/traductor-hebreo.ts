import { GoogleGenAI } from "@google/genai";
import { db, noticiasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

const PROMPT_TRADUCCION = `Sos traductor profesional español → hebreo moderno, con nivel y rigor de la Universidad Hebrea de Jerusalén y de la Academia de la Lengua Hebrea (האקדמיה ללשון העברית).

Tarea: traducir un artículo periodístico de fútbol (Club Atlético River Plate) al hebreo moderno actual, gramática perfecta, ortografía impecable, estilo periodístico israelí natural y fluido — como El País deportes pero en hebreo.

Reglas estrictas:
1. Nombres propios de jugadores, técnicos, clubes y lugares: transliterar al hebreo con la convención periodística israelí estándar.
   - "River Plate" → "ריבר פלאטה"
   - "Eduardo Coudet" / "El Chacho" → "אדוארדו קודה" / "אל צ׳אצ׳ו"
   - "Monumental" → "מונומנטל"
   - "Núñez" → "נוניס"
   - "Buenos Aires" → "בואנוס איירס"
   - "Ramat Gan" → "רמת גן"
   - "Filial" → "סניף"
2. Mantené la estructura: bajada en negrita al inicio (con *asteriscos*), después párrafos.
3. NO inventes información ni cambies hechos. Traducción literal del sentido, idiomática del idioma.
4. Hashtags: traducidos al hebreo.

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

    return {
      tituloHe: mTit[1].trim(),
      contenidoHe: mCon[1].trim(),
      tagsHe: (mTag?.[1] ?? "#ריברפלאטה #ריברישראל #רמתגן #הגדולמכולם").trim(),
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
export async function traducirYGuardarHebreo(noticiaId: number): Promise<void> {
  try {
    const [noticia] = await db.select().from(noticiasTable).where(eq(noticiasTable.id, noticiaId));
    if (!noticia) return;
    if (noticia.contenidoHe && noticia.contenidoHe.length > 100) {
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

    await db.update(noticiasTable).set(traduccion).where(eq(noticiasTable.id, noticiaId));
    logger.info({ id: noticiaId, tituloHe: traduccion.tituloHe }, "✡ Traducción hebrea guardada");
  } catch (err) {
    logger.error({ err, noticiaId }, "Error en traducirYGuardarHebreo");
  }
}
