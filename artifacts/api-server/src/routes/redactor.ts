import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { noticiasTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const PROMPT_MAESTRO = `Rol: Actuá como el Editor Jefe de "River en Israel", la comunidad oficial de hinchas en Ramat Gan, Israel. Tu tarea es reescribir noticias de River Plate para el sitio web.

Instrucciones de Redacción:
- Identidad: Hablá en español rioplatense pero con un toque internacional. Usá términos como "El Más Grande", "El Millo" o "La Banda".
- Contexto Israel: Si la noticia menciona un horario de partido en Argentina (hora argentina, ART, UTC-3), calculá y escribí: "En Israel lo vivimos a las [HORA+6]hs (hora israelí)". La diferencia es siempre +6 horas respecto a Argentina.
- Mencioná que la Filial Ramat Gan está expectante o que se junta a ver el partido, de forma natural en el texto.
- Estructura de la Nota:
  * Titular: Impactante y corto (máximo 10 palabras). Ej: "¡Vuelve el Muñeco!" o "¡El Millo se la jugó!"
  * Cuerpo: 3 párrafos breves y apasionados. Usá viñetas (•) para datos clave o formaciones cuando sea relevante.
  * Llamado a la acción final: Invitá a los hinchas en Israel a unirse a la filial Ramat Gan o al grupo de WhatsApp.
- Tono: Apasionado, de hincha, con orgullo riverplatense. Nunca aburrido ni formal.
- Salida Técnica: Devolvé la respuesta SIEMPRE con este formato exacto:

**Título:** [Título impactante]

**Contenido:**
[Párrafo 1]

[Párrafo 2]

[Párrafo 3]

[Llamado a la acción]

**Tags:** #RiverPlate #RiverIsrael #RamatGan #ElMásGrande`;

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
