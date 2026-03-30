import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { noticiasTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { logger } from "../lib/logger";
import { ejecutarCiclo } from "../scheduler";

const router: IRouter = Router();

// ─── HELPERS TELEGRAM ─────────────────────────────────────────────────────────

async function enviarMensajeTelegram(token: string, chatId: string, text: string, options?: Record<string, unknown>) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...options }),
    });
  } catch (err) {
    logger.warn({ err }, "Telegram: error enviando mensaje");
  }
}

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

// ─── COMANDO /noticia ─────────────────────────────────────────────────────────
// Envía la última noticia publicada al chat

async function handleComandoNoticia(token: string, chatId: string) {
  try {
    const [ultima] = await db
      .select()
      .from(noticiasTable)
      .where(and(eq(noticiasTable.publicada, true), eq(noticiasTable.pendiente, false)))
      .orderBy(desc(noticiasTable.creadoEn))
      .limit(1);

    if (!ultima) {
      await enviarMensajeTelegram(token, chatId, "⚠️ No hay noticias publicadas todavía.");
      return;
    }

    const bajadaTexto = ultima.bajada ? `\n_${ultima.bajada}_\n` : "";
    const resumen = ultima.contenido
      ? ultima.contenido.slice(0, 300) + (ultima.contenido.length > 300 ? "…" : "")
      : "";
    const fuente = ultima.fuente ? `\n📰 Fuente: ${ultima.fuente}` : "";
    const tags = ultima.tags ? `\n🏷 ${ultima.tags}` : "";

    const domain = process.env.TELEGRAM_WEBHOOK_DOMAIN ?? process.env.REPLIT_DEV_DOMAIN;
    const verLink = domain ? `\n\n🌐 [Ver en el sitio](https://${domain})` : "";

    const texto =
      `📢 *ÚLTIMA NOTICIA*\n\n*${ultima.titulo}*\n${bajadaTexto}\n${resumen}${fuente}${tags}${verLink}`;

    await enviarMensajeTelegram(token, chatId, texto);
  } catch (err) {
    logger.error({ err }, "Telegram /noticia: error");
    await enviarMensajeTelegram(token, chatId, "❌ Error al obtener la última noticia.");
  }
}

// ─── COMANDO /buscar ──────────────────────────────────────────────────────────
// Dispara el ciclo completo del scheduler (scrapeo + IA + Telegram)

async function handleComandoBuscar(token: string, chatId: string) {
  await enviarMensajeTelegram(
    token, chatId,
    "🔍 *Buscando noticias…*\n\nIniciando escaneo de todos los medios. Las notas transformadas por IA llegarán en unos minutos con sus botones ✅ ✏️ ❌."
  );
  try {
    await ejecutarCiclo();
  } catch (err) {
    logger.error({ err }, "Telegram /buscar: error en ciclo");
    await enviarMensajeTelegram(token, chatId, "❌ Hubo un error durante la búsqueda. Revisá los logs.");
  }
}

// ─── PROCESAMIENTO DE CALLBACKS (botones ✅ ✏️ ❌) ────────────────────────────

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

      await responderCallback(token, callbackId, "✅ Publicando...");

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

      await responderCallback(token, callbackId, "❌ Rechazando...");

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
    message?: {
      message_id: number;
      chat: { id: number };
      text?: string;
    };
  };

  // ── Comandos de texto ──
  const msg = update.message;
  if (msg?.text) {
    const texto = msg.text.trim().toLowerCase();
    const fromChatId = String(msg.chat.id);

    if (texto.startsWith("/noticia")) {
      setImmediate(() => {
        handleComandoNoticia(token, fromChatId).catch((err) =>
          logger.error({ err }, "Telegram /noticia: error asíncrono")
        );
      });
      return;
    }

    if (texto.startsWith("/buscar")) {
      setImmediate(() => {
        handleComandoBuscar(token, fromChatId).catch((err) =>
          logger.error({ err }, "Telegram /buscar: error asíncrono")
        );
      });
      return;
    }
  }

  // ── Botones de aprobación (callback_query) ──
  const callback = update.callback_query;
  if (!callback?.data) return;

  const { id: callbackId, data, message } = callback;
  const messageId = String(message?.message_id ?? "");

  setImmediate(() => {
    procesarCallback(token, chatId, callbackId, data, messageId).catch((err) =>
      logger.error({ err }, "Telegram webhook: error en procesamiento asíncrono")
    );
  });
});

export default router;
