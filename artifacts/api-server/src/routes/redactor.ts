import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { noticiasTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const PROMPT_MAESTRO = `Rol: Sos un periodista deportivo argentino de primer nivel, con el estilo narrativo de Juan Pablo Varsky y la profundidad analítica de los grandes referentes del periodismo de River Plate. Escribís para "River en Israel", el sitio web de la comunidad riverplatense en Israel. Tu trabajo es reescribir noticias de River Plate con calidad periodística real.

ESTILO DE ESCRITURA:
- Voz: Periodística, precisa, con peso narrativo. Cada palabra importa. Evitá muletillas, lugares comunes y frases hechas.
- Titular: Debe generar impacto y curiosidad inmediata. No más de 12 palabras. Sin signos de exclamación forzados. El título debe decir algo, no adornar. Ejemplos de calidad: "Gallardo deja ir a su pieza clave: el mercado que viene sacude todo", "La decisión que nadie esperaba y que cambia el equipo de cuajo", "El dato que explica por qué River va a ser protagonista esta temporada".
- Cuerpo de la nota: Mínimo 4 párrafos sólidos. Cada párrafo agrega información nueva, contexto o análisis. El lector debe sentir que aprendió algo al terminar. Evitá párrafos de relleno.
- Introducción: El primer párrafo engancha al lector de inmediato. Plantea el núcleo de la historia sin rodeos.
- Desarrollo: Ampliá con antecedentes, cifras, contexto histórico, declaraciones (si las hay en la fuente) y análisis de lo que significa para el equipo.
- Usá viñetas (•) solo cuando sea útil para datos concretos: formaciones, estadísticas, fechas de partidos.
- Si la noticia menciona un horario de partido en Argentina (ART, UTC-3), calculá el horario israelí sumando 6 horas y agregalo de forma natural: "En Israel, el partido se vive a las [HORA+6] (hora local)".
- Tono: Serio y periodístico. Nunca panfletario ni de hinchada. Podés transmitir la importancia del momento sin perder el rigor.
- PROHIBIDO: No agregues ningún llamado a unirse a la filial, al grupo de WhatsApp ni a ninguna comunidad. No pongas cierres del tipo "desde Israel lo vivimos…" o "la Filial Ramat Gan…". La nota termina periodísticamente, no con publicidad.

FORMATO DE SALIDA (obligatorio, sin variaciones):

**Título:** [Título periodístico de impacto]

**Contenido:**
[Párrafo de introducción]

[Párrafo de desarrollo/contexto]

[Párrafo de análisis o datos relevantes]

[Párrafo de cierre periodístico — qué sigue, qué está en juego]

**Tags:** #RiverPlate [otros tags relevantes según la noticia]`;

function parsearResultado(texto: string): { titulo: string; contenido: string; tags: string } {
  const tituloMatch = texto.match(/\*\*Título:\*\*\s*(.+)/);
  const tagsMatch = texto.match(/\*\*Tags:\*\*\s*(.+)/);

  const titulo = tituloMatch?.[1]?.trim() ?? "Sin título";
  const tags = tagsMatch?.[1]?.trim() ?? "#RiverPlate #RiverIsrael #RamatGan";

  const contenido = texto
    .replace(/\*\*Título:\*\*\s*.+\n?/, "")
    .replace(/\*\*Contenido:\*\*\s*\n?/, "")
    .replace(/\*\*Tags:\*\*\s*.+\n?/, "")
    .trim();

  return { titulo, contenido, tags };
}

router.post("/procesar-noticia", async (req, res) => {
  const { texto } = req.body as { texto?: string };

  if (!texto || texto.trim().length < 10) {
    res.status(400).json({ error: "Falta el texto de la noticia" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: PROMPT_MAESTRO },
        { role: "user", content: `Transformá esta noticia para el sitio River en Israel:\n\n${texto}` }
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Error procesando noticia con IA");
    res.write(`data: ${JSON.stringify({ error: "Error al procesar la noticia" })}\n\n`);
    res.end();
  }
});

router.post("/enviar-telegram", async (req, res) => {
  const { texto, textoOriginal, fuente } = req.body as {
    texto?: string;
    textoOriginal?: string;
    fuente?: string;
  };

  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    res.status(503).json({ error: "Telegram no está configurado." });
    return;
  }

  if (!texto || texto.trim().length < 5) {
    res.status(400).json({ error: "Falta el texto a enviar" });
    return;
  }

  try {
    const { titulo, contenido, tags } = parsearResultado(texto);

    const [noticia] = await db
      .insert(noticiasTable)
      .values({
        titulo,
        contenido,
        tags,
        textoOriginal: textoOriginal ?? "",
        fuente: fuente ?? "",
        publicada: false,
        pendiente: true,
      })
      .returning();

    const mensajeTexto =
      `📰 *NUEVA NOTA — River en Israel*\n\n` +
      `*${titulo}*\n\n` +
      `${contenido.slice(0, 700)}${contenido.length > 700 ? "..." : ""}\n\n` +
      `${tags}\n\n` +
      `_¿Publicamos esta nota en el sitio?_`;

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: mensajeTexto,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Publicar", callback_data: `publicar_${noticia.id}` },
              { text: "✏️ Editar", callback_data: `editar_${noticia.id}` },
              { text: "❌ Rechazar", callback_data: `rechazar_${noticia.id}` },
            ],
          ],
        },
      }),
    });

    const tgData = await tgRes.json() as { ok: boolean; result?: { message_id: number } };

    if (!tgRes.ok || !tgData.ok) {
      req.log.error({ tgData }, "Error enviando a Telegram");
      res.status(500).json({ error: "Error al enviar a Telegram" });
      return;
    }

    const messageId = String(tgData.result?.message_id ?? "");
    if (messageId) {
      await db
        .update(noticiasTable)
        .set({ telegramMessageId: messageId })
        .where(eq(noticiasTable.id, noticia.id));
    }

    res.json({ ok: true, noticiaId: noticia.id });
  } catch (err) {
    req.log.error({ err }, "Error en enviar-telegram");
    res.status(500).json({ error: "Error de conexión con Telegram" });
  }
});

export default router;
