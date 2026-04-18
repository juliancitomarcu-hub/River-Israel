import { Router, type IRouter } from "express";
import { ai } from "@workspace/integrations-gemini-ai";
import { db } from "@workspace/db";
import { noticiasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { PROMPT_MAESTRO } from "../lib/prompt-maestro";

const router: IRouter = Router();

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

  if (bajada) {
    contenido = `*${bajada}*\n\n${contenido}`;
  }

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
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: `Transformá esta noticia para el sitio River en Israel:\n\n${texto}` }] }],
      config: {
        systemInstruction: PROMPT_MAESTRO,
        maxOutputTokens: 8192,
      },
    });

    for await (const chunk of stream) {
      const content = chunk.text;
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
  const { texto, textoOriginal, fuente, imagenPortada } = req.body as {
    texto?: string;
    textoOriginal?: string;
    fuente?: string;
    imagenPortada?: string;
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
        imagenPortada: imagenPortada ?? "",
      })
      .returning();

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: "✅ Publicar", callback_data: `publicar_${noticia.id}` },
          { text: "✏️ Editar", callback_data: `editar_${noticia.id}` },
          { text: "❌ Rechazar", callback_data: `rechazar_${noticia.id}` },
        ],
      ],
    };

    // Texto completo como mensaje independiente — nunca como caption de foto.
    // La imagen se adjunta por separado vía el botón 📸 (telegram-webhook.ts).
    // Telegram admite hasta 4096 chars en sendMessage, vs 1024 en caption de imagen.
    const TELEGRAM_MAX = 4096;
    const encabezado = `📰 *NUEVA NOTA — River en Israel*\n\n*${titulo}*\n\n`;
    const pie = `\n\n${tags}\n\n_¿Publicamos esta nota en el sitio?_`;
    const maxCuerpo = TELEGRAM_MAX - encabezado.length - pie.length - 5;
    const cuerpo = contenido.length > maxCuerpo ? contenido.slice(0, maxCuerpo) + "…" : contenido;
    const mensajeTexto = encabezado + cuerpo + pie;

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: mensajeTexto,
        parse_mode: "Markdown",
        reply_markup: replyMarkup,
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

router.post("/test-scheduler", async (req, res) => {
  const { fuente } = req.body as { fuente?: string };
  const { ejecutarCiclo } = await import("../scheduler");
  res.json({ ok: true, mensaje: "Ciclo iniciado en segundo plano — mirá tu Telegram en ~60 segundos" });
  ejecutarCiclo(fuente).catch((err) => req.log.error({ err }, "Error en test-scheduler"));
});

export default router;
