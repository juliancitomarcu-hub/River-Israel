import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { noticiasTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
import { ejecutarCiclo } from "../scheduler";

const router: IRouter = Router();

// ─── ESTADO EN MEMORIA: espera de foto por chat ───────────────────────────────
// Map<chatId, noticiaId> — cuando el user hace clic en 📸, guardamos el contexto
const esperandoFoto = new Map<string, number>();

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

async function editarMensajeTelegram(token: string, chatId: string, messageId: string, nuevoTexto: string, teclado?: object) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: nuevoTexto,
        parse_mode: "Markdown",
        reply_markup: teclado ?? { inline_keyboard: [] },
      }),
    });
  } catch (err) {
    logger.warn({ err }, "Telegram: error editando mensaje");
  }
}

// Descarga la foto desde Telegram y retorna la URL pública del archivo
async function obtenerUrlFoto(token: string, fileId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const data = await res.json() as { ok: boolean; result?: { file_path?: string } };
    if (!data.ok || !data.result?.file_path) return null;
    return `https://api.telegram.org/file/bot${token}/${data.result.file_path}`;
  } catch (err) {
    logger.warn({ err }, "Telegram: error obteniendo URL de foto");
    return null;
  }
}

// ─── BOTONES ──────────────────────────────────────────────────────────────────

function botonesAprobacion(noticiaId: number) {
  return {
    inline_keyboard: [
      [
        { text: "✅ Publicar",  callback_data: `publicar_${noticiaId}` },
        { text: "✏️ Editar",   callback_data: `editar_${noticiaId}` },
        { text: "📸 Foto",     callback_data: `foto_${noticiaId}` },
        { text: "❌ Rechazar", callback_data: `rechazar_${noticiaId}` },
      ],
    ],
  };
}

// ─── COMANDO /noticia ─────────────────────────────────────────────────────────

async function handleComandoNoticia(token: string, chatId: string) {
  try {
    let [nota] = await db
      .select()
      .from(noticiasTable)
      .where(eq(noticiasTable.pendiente, true))
      .orderBy(desc(noticiasTable.createdAt))
      .limit(1);

    const hayPendiente = !!nota;
    if (!nota) {
      [nota] = await db
        .select()
        .from(noticiasTable)
        .where(eq(noticiasTable.publicada, true))
        .orderBy(desc(noticiasTable.createdAt))
        .limit(1);
    }

    if (!nota) {
      await enviarMensajeTelegram(token, chatId, "⚠️ No hay notas todavía. Usá /buscar para escanear medios.");
      return;
    }

    const bajada = nota.bajada ? `\n_${nota.bajada}_\n` : "";
    const resumen = nota.contenido
      ? nota.contenido.slice(0, 400) + (nota.contenido.length > 400 ? "…" : "")
      : "";
    const fuente = nota.fuente ? `\n📰 ${nota.fuente}` : "";
    const tags = nota.tags ? `\n🏷 ${nota.tags}` : "";
    const fotoIndicador = nota.imagenPortada ? "\n🖼 _Con foto de portada_" : "";

    const encabezado = hayPendiente
      ? "📝 *NOTA PENDIENTE DE APROBACIÓN*"
      : "📢 *ÚLTIMA NOTA PUBLICADA*";

    const texto = `${encabezado}\n\n*${nota.titulo}*${bajada}\n${resumen}${fuente}${tags}${fotoIndicador}`;

    if (hayPendiente) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: texto,
          parse_mode: "Markdown",
          reply_markup: botonesAprobacion(nota.id),
        }),
      });
    } else {
      await enviarMensajeTelegram(token, chatId, texto + "\n\n_Usá /buscar para encontrar nuevas notas._");
    }
  } catch (err) {
    logger.error({ err }, "Telegram /noticia: error");
    await enviarMensajeTelegram(token, chatId, "❌ Error al obtener la nota. Intentá de nuevo.");
  }
}

// ─── COMANDO /buscar ──────────────────────────────────────────────────────────

async function handleComandoBuscar(token: string, chatId: string) {
  await enviarMensajeTelegram(
    token, chatId,
    "🔍 *Buscando noticias…*\n\nIniciando escaneo de todos los medios. Las notas transformadas por IA llegarán en unos minutos con sus botones ✅ ✏️ 📸 ❌."
  );
  try {
    await ejecutarCiclo();
  } catch (err) {
    logger.error({ err }, "Telegram /buscar: error en ciclo");
    await enviarMensajeTelegram(token, chatId, "❌ Hubo un error durante la búsqueda. Revisá los logs.");
  }
}

// ─── PROCESAMIENTO DE FOTO ENTRANTE ───────────────────────────────────────────

async function procesarFotoEntrante(
  token: string,
  chatId: string,
  fileId: string
) {
  const noticiaId = esperandoFoto.get(chatId);
  if (!noticiaId) return; // no hay contexto activo para este chat

  esperandoFoto.delete(chatId);

  try {
    const url = await obtenerUrlFoto(token, fileId);
    if (!url) {
      await enviarMensajeTelegram(token, chatId, "❌ No pude procesar la imagen. Intentá de nuevo con /noticia y volvé a tocar 📸 Foto.");
      return;
    }

    const [nota] = await db
      .update(noticiasTable)
      .set({ imagenPortada: url })
      .where(eq(noticiasTable.id, noticiaId))
      .returning();

    if (!nota) {
      await enviarMensajeTelegram(token, chatId, "❌ No encontré la nota para agregar la foto.");
      return;
    }

    await enviarMensajeTelegram(
      token, chatId,
      `🖼 *¡Foto guardada!*\n\n*${nota.titulo}*\n\nLa imagen quedó como portada de la nota. Ahora podés:\n\n✅ Publicarla en el sitio\n✏️ Editarla en el redactor`,
      { reply_markup: botonesAprobacion(noticiaId) }
    );

    logger.info({ noticiaId, url }, "Telegram: foto de portada guardada");
  } catch (err) {
    logger.error({ err, noticiaId }, "Telegram: error procesando foto entrante");
    await enviarMensajeTelegram(token, chatId, "❌ Error guardando la foto. Intentá de nuevo.");
  }
}

// ─── PROCESAMIENTO DE CALLBACKS ───────────────────────────────────────────────

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
      if (actual.publicada) {
        // Ya publicada — avisar sin hacer nada (evita doble publicación)
        await responderCallback(token, callbackId, "⚠️ Esta nota ya fue publicada.");
        return;
      }

      const [noticia] = await db
        .update(noticiasTable)
        .set({ publicada: true, pendiente: false })
        .where(eq(noticiasTable.id, noticiaId))
        .returning();

      const fotoTexto = noticia?.imagenPortada ? "\n🖼 _Publicada con foto de portada._" : "";
      if (messageId) {
        await editarMensajeTelegram(
          token, chatId, messageId,
          `✅ *PUBLICADA* — ${noticia?.titulo ?? "Nota publicada"}\n\n_Ya está visible en la sección Actualidad del sitio web._${fotoTexto}`
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
          text: `✏️ *Editar nota #${noticiaId}*\n\nHacé clic para editar el texto y la foto antes de publicar:\n${editUrl}`,
          parse_mode: "Markdown",
        }),
      });

    } else if (data.startsWith("foto_")) {
      const noticiaId = parseInt(data.replace("foto_", ""));
      if (isNaN(noticiaId)) return;

      await responderCallback(token, callbackId, "📸 Enviame la foto");

      // Guardar el estado: este chat está esperando una foto para esta noticia
      esperandoFoto.set(chatId, noticiaId);

      // Auto-limpiar el estado después de 5 minutos si el usuario no envía nada
      setTimeout(() => {
        if (esperandoFoto.get(chatId) === noticiaId) {
          esperandoFoto.delete(chatId);
        }
      }, 5 * 60 * 1000);

      await enviarMensajeTelegram(
        token, chatId,
        `📸 *Agregar foto a nota #${noticiaId}*\n\n¡Perfecto! Enviame ahora la imagen que querés usar como portada.\n\n_Tenés 5 minutos. Mandá la foto directamente en este chat._`
      );

    } else if (data.startsWith("rechazar_")) {
      const noticiaId = parseInt(data.replace("rechazar_", ""));
      if (isNaN(noticiaId)) return;

      await responderCallback(token, callbackId, "❌ Rechazando...");

      const [actual] = await db.select().from(noticiasTable).where(eq(noticiasTable.id, noticiaId));
      if (!actual) return;
      if (!actual.pendiente) {
        // Ya procesada — avisar sin hacer nada
        await responderCallback(token, callbackId, "ℹ️ Esta nota ya fue procesada.");
        return;
      }

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
  res.status(200).json({ ok: true });

  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return;

  const update = req.body as {
    callback_query?: {
      id: string;
      data?: string;
      message?: { message_id: number };
      from?: { id: number };
    };
    message?: {
      message_id: number;
      chat: { id: number };
      from?: { id: number };
      text?: string;
      photo?: { file_id: string; file_size?: number }[];
    };
  };

  const msg = update.message;
  if (msg) {
    const fromChatId = String(msg.chat.id);

    // ── Foto entrante ────────────────────────────────────────────────────
    if (msg.photo && msg.photo.length > 0) {
      // Usar la foto de mayor resolución (último elemento)
      const mejorFoto = msg.photo[msg.photo.length - 1];
      setImmediate(() => {
        procesarFotoEntrante(token, fromChatId, mejorFoto.file_id).catch((err) =>
          logger.error({ err }, "Telegram: error asíncrono procesando foto")
        );
      });
      return;
    }

    // ── Comandos de texto ────────────────────────────────────────────────
    if (msg.text) {
      const texto = msg.text.trim().toLowerCase();

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

      // Si el usuario envía texto mientras se espera foto, cancelar la espera
      if (esperandoFoto.has(fromChatId)) {
        esperandoFoto.delete(fromChatId);
        setImmediate(() => {
          enviarMensajeTelegram(token, fromChatId, "📸 Operación de foto cancelada. Usá /noticia para volver a ver la nota con los botones.").catch(() => {});
        });
      }
    }
  }

  // ── Botones de aprobación (callback_query) ───────────────────────────────
  const callback = update.callback_query;
  if (!callback?.data) return;

  const { id: callbackId, data, message } = callback;
  const messageId = String(message?.message_id ?? "");
  const fromChatId = String(callback.from?.id ?? chatId);

  setImmediate(() => {
    procesarCallback(token, fromChatId, callbackId, data, messageId).catch((err) =>
      logger.error({ err }, "Telegram webhook: error en procesamiento asíncrono")
    );
  });
});

export default router;
