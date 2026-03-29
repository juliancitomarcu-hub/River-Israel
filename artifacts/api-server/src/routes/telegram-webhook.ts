import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { noticiasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── HELPERS TELEGRAM ─────────────────────────────────────────────────────────

async function responderCallback(token: string, callbackQueryId: string, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }),
    });
  } catch (err) {
    logger.warn({ err }, "Telegram: error respondiendo callback");
  }
}

async function editarMensajeTelegram(token: string, chatId: string, messageId: string, nuevoTexto: string) {
  try {
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
  } catch (err) {
    logger.warn({ err }, "Telegram: error editando mensaje");
  }
}

// ─── PROCESAMIENTO ASÍNCRONO ──────────────────────────────────────────────────
// Todo el trabajo real se hace DESPUÉS de responder 200 a Telegram.
// Esto evita timeouts de Telegram y reintentos duplicados.

async function procesarCallback(
  token: string,
  chatId: string,
  callbackId: string,
  data: string,
  messageId: string
) {
  try {
    if (data.startsWith("publicar_")) {
      const noticiaId = parseInt(data.replace("publicar_", ""));
      if (isNaN(noticiaId)) return;

      // ⚡ Responder al botón PRIMERO — quita el "cargando" instantáneamente
      await responderCallback(token, callbackId, "✅ Publicando...");

      // Idempotencia: verificar estado actual antes de actuar
      const [actual] = await db.select().from(noticiasTable).where(eq(noticiasTable.id, noticiaId));
      if (!actual) return;
      if (actual.publicada) return;

      const [noticia] = await db
        .update(noticiasTable)
        .set({ publicada: true, pendiente: false })
        .where(eq(noticiasTable.id, noticiaId))
        .returning();

      if (messageId) {
        await editarMensajeTelegram(
          token, chatId, messageId,
          `✅ *PUBLICADA* — ${noticia?.titulo ?? "Nota publicada"}\n\n_Ya está visible en la sección Actualidad del sitio web._`
        );
      }

    } else if (data.startsWith("editar_")) {
      const noticiaId = parseInt(data.replace("editar_", ""));
      if (isNaN(noticiaId)) return;

      const domain = process.env.TELEGRAM_WEBHOOK_DOMAIN ?? process.env.REPLIT_DEV_DOMAIN;
      if (!domain) {
        await responderCallback(token, callbackId, "⚠️ No se pudo generar el link");
        return;
      }

      const editUrl = `https://${domain}/redactor?editar=${noticiaId}`;

      // ⚡ Responder al botón PRIMERO
      await responderCallback(token, callbackId, "✏️ Link enviado");

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `✏️ *Editar nota #${noticiaId}*\n\nHacé clic acá para editar y agregar foto antes de publicarla:\n${editUrl}`,
          parse_mode: "Markdown",
        }),
      });

    } else if (data.startsWith("rechazar_")) {
      const noticiaId = parseInt(data.replace("rechazar_", ""));
      if (isNaN(noticiaId)) return;

      // ⚡ Responder al botón PRIMERO
      await responderCallback(token, callbackId, "❌ Rechazando...");

      // Idempotencia
      const [actual] = await db.select().from(noticiasTable).where(eq(noticiasTable.id, noticiaId));
      if (!actual) return;
      if (!actual.pendiente) return;

      const [noticia] = await db
        .update(noticiasTable)
        .set({ publicada: false, pendiente: false })
        .where(eq(noticiasTable.id, noticiaId))
        .returning();

      if (messageId) {
        await editarMensajeTelegram(
          token, chatId, messageId,
          `❌ *RECHAZADA* — ${noticia?.titulo ?? "Nota rechazada"}\n\n_No será publicada en el sitio._`
        );
      }
    }
  } catch (err) {
    logger.error({ err, data }, "Telegram webhook: error procesando callback");
  }
}

// ─── ENDPOINT ─────────────────────────────────────────────────────────────────

router.post("/telegram-webhook", (req, res) => {
  // ⚡ Responder 200 a Telegram INMEDIATAMENTE — antes de cualquier operación.
  // Si no respondemos en ~5 segundos, Telegram reintenta y genera duplicados.
  res.status(200).json({ ok: true });

  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return;

  const update = req.body as {
    callback_query?: {
      id: string;
      data?: string;
      message?: { message_id: number };
    };
  };

  const callback = update.callback_query;
  if (!callback?.data) return;

  const { id: callbackId, data, message } = callback;
  const messageId = String(message?.message_id ?? "");

  // Procesar de forma asíncrona — sin bloquear la respuesta ya enviada
  setImmediate(() => {
    procesarCallback(token, chatId, callbackId, data, messageId).catch((err) =>
      logger.error({ err }, "Telegram webhook: error en procesamiento asíncrono")
    );
  });
});

export default router;
