import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { noticiasTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

async function editarMensajeTelegram(
  token: string,
  chatId: string,
  messageId: string,
  nuevoTexto: string
) {
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: nuevoTexto,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [] },
    }),
  });
}

async function responderCallback(token: string, callbackQueryId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

router.post("/telegram-webhook", async (req, res) => {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    res.status(200).json({ ok: true });
    return;
  }

  const update = req.body as {
    callback_query?: {
      id: string;
      data?: string;
      message?: { message_id: number; text?: string };
    };
  };

  const callback = update.callback_query;
  if (!callback || !callback.data) {
    res.status(200).json({ ok: true });
    return;
  }

  const { id: callbackId, data, message } = callback;
  const messageId = String(message?.message_id ?? "");

  if (data.startsWith("publicar_")) {
    const noticiaId = parseInt(data.replace("publicar_", ""));

    if (!isNaN(noticiaId)) {
      const [noticia] = await db
        .update(noticiasTable)
        .set({ publicada: true, pendiente: false })
        .where(eq(noticiasTable.id, noticiaId))
        .returning();

      await responderCallback(token, callbackId, "✅ ¡Nota publicada en el sitio!");

      if (messageId) {
        await editarMensajeTelegram(
          token,
          chatId,
          messageId,
          `✅ *PUBLICADA* — ${noticia?.titulo ?? "Nota publicada"}\n\n_Ya está visible en la sección Actualidad del sitio web._`
        );
      }
    }
  } else if (data.startsWith("rechazar_")) {
    const noticiaId = parseInt(data.replace("rechazar_", ""));

    if (!isNaN(noticiaId)) {
      const [noticia] = await db
        .update(noticiasTable)
        .set({ publicada: false, pendiente: false })
        .where(eq(noticiasTable.id, noticiaId))
        .returning();

      await responderCallback(token, callbackId, "❌ Nota rechazada");

      if (messageId) {
        await editarMensajeTelegram(
          token,
          chatId,
          messageId,
          `❌ *RECHAZADA* — ${noticia?.titulo ?? "Nota rechazada"}\n\n_No será publicada en el sitio._`
        );
      }
    }
  }

  res.status(200).json({ ok: true });
});

export default router;
