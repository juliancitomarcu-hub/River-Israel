import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { noticiasTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
import { ejecutarCiclo, type EjecucionResultado } from "../scheduler";
import { createEditToken } from "../lib/edit-tokens";
import { traducirYGuardarHebreo } from "../lib/traductor-hebreo";

const router: IRouter = Router();

// ─── ESTADO EN MEMORIA ────────────────────────────────────────────────────────
// Map<chatId, noticiaId> — contextos de espera por acción del user
const esperandoFoto    = new Map<string, number>(); // espera foto para nota X
const esperandoEdicion = new Map<string, number>(); // espera texto editado para nota X

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
    inline_keyboard: [[
      { text: "✅ Publicar", callback_data: `publicar_${noticiaId}` },
      { text: "✏️ Editar",  callback_data: `editar_${noticiaId}` },
    ]],
  };
}

// ─── FUENTES PARA REINTENTOS ──────────────────────────────────────────────────
// Si una fuente no tiene noticias nuevas, probamos con las siguientes.
const FUENTES_FALLBACK = [
  "pagina", "ole", "google", "tyc", "infobae",
  "clarin", "bolavip", "as", "lanacion", "superdeportivo",
] as const;

// ─── MENSAJE LEGIBLE POR RESULTADO ───────────────────────────────────────────
function mensajeDeResultado(r: EjecucionResultado): string {
  switch (r.tipo) {
    case "ok":
      return `✅ *¡Listo!* La nota llegará con los botones de aprobación.\n\n📰 _${r.titulo}_`;
    case "todas_procesadas":
      return `📭 _Fuente ${r.fuente}: todas las noticias disponibles ya fueron enviadas esta semana._`;
    case "sin_noticias":
      return `📭 _Fuente ${r.fuente}: no se encontraron artículos de River._`;
    case "scraping_fallido":
      return `⚠️ _Fuente ${r.fuente}: el sitio no respondió correctamente._`;
    case "concurrente":
      return `⏳ _Ya hay una búsqueda en curso. Esperá unos segundos y volvé a intentar._`;
    case "ia_sin_contenido":
      return `🤖 _La IA no pudo generar contenido. Intentá de nuevo en un momento._`;
    case "telegram_error":
      return `⚠️ _La nota se generó pero Telegram no respondió al enviarla._`;
    case "error":
      return `❌ _Error inesperado: ${r.mensaje.slice(0, 200)}_`;
  }
}

// ─── BUSCAR CON REINTENTOS ────────────────────────────────────────────────────
// Intenta hasta MAX_INTENTOS fuentes distintas hasta encontrar una noticia nueva.
async function ejecutarBusquedaConReintentos(
  token: string,
  chatId: string,
  fuenteInicial?: string
): Promise<void> {
  const MAX_INTENTOS = 4;
  let fuentesIntentadas: string[] = [];

  // Si hay concurrencia, esperar 20s y reintentar una vez
  const primerIntento = await ejecutarCiclo(fuenteInicial);
  if (primerIntento.tipo === "concurrente") {
    await enviarMensajeTelegram(token, chatId, "⏳ Hay una búsqueda en curso. Reintentando en 20 segundos…");
    await new Promise(r => setTimeout(r, 20_000));
    const reintento = await ejecutarCiclo(fuenteInicial);
    if (reintento.tipo === "concurrente") {
      await enviarMensajeTelegram(token, chatId, "⏳ _El sistema sigue ocupado. La noticia llegará en cuanto termine el proceso actual._");
      return;
    }
    if (reintento.tipo === "ok") {
      await enviarMensajeTelegram(token, chatId, mensajeDeResultado(reintento));
      return;
    }
  } else if (primerIntento.tipo === "ok") {
    // Éxito en el primer intento — no hace falta decir nada más (el mensaje llegó con botones)
    return;
  }

  // Si falló por noticias repetidas/vacías, probar otras fuentes
  const fuentesDePrimerIntento = "fuente" in primerIntento ? primerIntento.fuente : "";
  fuentesIntentadas = [fuentesDePrimerIntento];

  if (primerIntento.tipo === "todas_procesadas" || primerIntento.tipo === "sin_noticias" || primerIntento.tipo === "scraping_fallido") {
    await enviarMensajeTelegram(token, chatId,
      `${mensajeDeResultado(primerIntento)}\n🔄 _Probando otras fuentes…_`
    );

    for (const fuente of FUENTES_FALLBACK) {
      if (fuentesIntentadas.includes(fuente)) continue;
      if (fuentesIntentadas.length >= MAX_INTENTOS) break;

      fuentesIntentadas.push(fuente);
      logger.info({ fuente }, "Telegram /buscar: reintentando con fuente alternativa");

      const r = await ejecutarCiclo(fuente);
      if (r.tipo === "ok") {
        await enviarMensajeTelegram(token, chatId, `✅ *¡Encontrada en ${fuente}!* La nota llegará con los botones de aprobación.`);
        return;
      }
      if (r.tipo === "concurrente" || r.tipo === "error" || r.tipo === "ia_sin_contenido") {
        await enviarMensajeTelegram(token, chatId, mensajeDeResultado(r));
        return;
      }
      // todas_procesadas / sin_noticias / scraping_fallido → seguir intentando
    }

    await enviarMensajeTelegram(token, chatId,
      `📭 *Sin noticias nuevas disponibles* (probé ${fuentesIntentadas.length} fuentes).\n\n_Esperá un rato y usá /buscar de nuevo, o el scheduler las mandará automáticamente._`
    );
    return;
  }

  // Cualquier otro resultado inesperado
  await enviarMensajeTelegram(token, chatId, mensajeDeResultado(primerIntento));
}

// ─── COMANDO /noticias y /noticia ─────────────────────────────────────────────
// Si hay una nota pendiente la muestra con botones.
// Si no hay ninguna, dispara una búsqueda nueva automáticamente.

async function handleComandoNoticia(token: string, chatId: string) {
  try {
    const [notaPendiente] = await db
      .select()
      .from(noticiasTable)
      .where(eq(noticiasTable.pendiente, true))
      .orderBy(desc(noticiasTable.createdAt))
      .limit(1);

    if (notaPendiente) {
      // Mostrar nota pendiente con artículo completo + 2 botones
      // Si tiene foto de portada, enviarla primero
      if (notaPendiente.imagenPortada) {
        await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            photo: notaPendiente.imagenPortada,
            caption: `🖼 _Foto de portada — ${notaPendiente.titulo}_`,
            parse_mode: "Markdown",
          }),
        }).catch(() => {});
      }

      const fuenteTag = notaPendiente.fuente ? `\n\n📡 _Fuente: ${notaPendiente.fuente}_` : "";
      const tagsTag = notaPendiente.tags ? `\n${notaPendiente.tags}` : "";
      const encabezado = `📰 *${notaPendiente.titulo}*\n\n`;
      const textoCompleto = encabezado + notaPendiente.contenido + tagsTag + fuenteTag;
      const TELE_MAX = 4096;
      const texto = textoCompleto.length > TELE_MAX
        ? textoCompleto.slice(0, TELE_MAX - 1).replace(/[^.!?…]*$/, "") + "."
        : textoCompleto;

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: texto,
          parse_mode: "Markdown",
          reply_markup: botonesAprobacion(notaPendiente.id),
        }),
      });
      return;
    }

    // No hay pendiente → buscar nueva noticia automáticamente
    await enviarMensajeTelegram(token, chatId,
      "🔍 No hay notas pendientes. *Buscando nueva noticia…*\n_Esto puede tardar hasta 1 minuto._"
    );
    await ejecutarBusquedaConReintentos(token, chatId);

  } catch (err) {
    logger.error({ err }, "Telegram /noticia: error");
    await enviarMensajeTelegram(token, chatId, "❌ Error al obtener la nota. Intentá de nuevo.");
  }
}

// ─── COMANDO /buscar ──────────────────────────────────────────────────────────
// Dispara una búsqueda nueva (ignorando notas pendientes existentes).

async function handleComandoBuscar(token: string, chatId: string) {
  await enviarMensajeTelegram(token, chatId,
    "🔍 *Buscando nueva noticia de River…*\n_Escaneando medios y procesando con IA. Hasta 1 minuto._"
  );
  try {
    await ejecutarBusquedaConReintentos(token, chatId);
  } catch (err) {
    logger.error({ err }, "Telegram /buscar: error en ciclo");
    await enviarMensajeTelegram(token, chatId, "❌ Hubo un error durante la búsqueda. Intentá de nuevo con /buscar.");
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

// ─── PROCESAMIENTO DE TEXTO EDITADO ──────────────────────────────────────────
// Cuando el user envía texto mientras esperandoEdicion está activo.

async function procesarTextoEditado(
  token: string,
  chatId: string,
  noticiaId: number,
  nuevoTexto: string
) {
  try {
    // Intentar extraer título si el usuario lo incluyó (primera línea en negrita o solo texto)
    const lineas = nuevoTexto.split("\n").map(l => l.trim()).filter(Boolean);
    const primerLinea = lineas[0] ?? "";

    // Determinar si la primera línea parece un título separado
    const tituloDetectado = primerLinea.length < 120 && lineas.length > 1 ? primerLinea.replace(/\*/g, "").trim() : null;
    const contenidoFinal = tituloDetectado ? lineas.slice(1).join("\n\n") : nuevoTexto;

    const [nota] = await db
      .update(noticiasTable)
      .set({
        contenido: contenidoFinal.trim(),
        ...(tituloDetectado ? { titulo: tituloDetectado } : {}),
        pendiente: true,
        publicada: false,
      })
      .where(eq(noticiasTable.id, noticiaId))
      .returning();

    if (!nota) {
      await enviarMensajeTelegram(token, chatId, "❌ No encontré la nota para guardar la edición.");
      return;
    }

    logger.info({ noticiaId, tituloDetectado }, "Telegram: texto editado guardado como Versión Final");

    await enviarMensajeTelegram(
      token, chatId,
      `✅ *¡Versión Final guardada!*\n\n*${nota.titulo}*\n\nLa nota fue actualizada con tu texto. Ahora podés publicarla:`,
      { reply_markup: botonesAprobacion(noticiaId) }
    );
  } catch (err) {
    logger.error({ err, noticiaId }, "Telegram: error procesando texto editado");
    await enviarMensajeTelegram(token, chatId, "❌ Error al guardar la edición. Intentá de nuevo con /noticia.");
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
        await responderCallback(token, callbackId, "⚠️ Esta nota ya fue publicada.");
        return;
      }

      const [noticia] = await db
        .update(noticiasTable)
        .set({ publicada: true, pendiente: false })
        .where(eq(noticiasTable.id, noticiaId))
        .returning();

      // 🌐 Traducir al hebreo en background
      traducirYGuardarHebreo(noticiaId).catch(() => {});

      const dominioTelegram = process.env.TELEGRAM_WEBHOOK_DOMAIN ?? "riverplateisrael.com";
      const fotoTexto = noticia?.imagenPortada ? "\n🖼 _Publicada con foto de portada._" : "";
      const linkSitio = `\n\n🌐 [Ver en el sitio](https://${dominioTelegram}/actualidad)`;

      if (messageId) {
        await editarMensajeTelegram(
          token, chatId, messageId,
          `✅ *PUBLICADA* — ${noticia?.titulo ?? "Nota publicada"}${fotoTexto}${linkSitio}`
        );
      }

    } else if (data.startsWith("editar_")) {
      const noticiaId = parseInt(data.replace("editar_", ""));
      if (isNaN(noticiaId)) return;

      await responderCallback(token, callbackId, "✏️ Texto enviado — podés editarlo");

      const [nota] = await db.select().from(noticiasTable).where(eq(noticiasTable.id, noticiaId));
      if (!nota) {
        await enviarMensajeTelegram(token, chatId, "❌ No encontré la nota para editar.");
        return;
      }

      // Enviar el texto completo (copyable) para que el user lo edite.
      // Mandamos en DOS mensajes para evitar el límite de 4096 chars de Telegram:
      // Msg 1: encabezado + título (copyable)
      // Msg 2: cuerpo + tags (el texto largo)

      const encabezadoEdicion = `📝 *TEXTO ACTUAL — Nota #${noticiaId}*\n\n*Título:* ${nota.titulo}`;
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: encabezadoEdicion, parse_mode: "Markdown" }),
      });

      // Cuerpo + tags — si aún supera 4096 cortamos en el límite
      const TELE_MAX = 4096;
      const cuerpoCompleto = `${nota.contenido}\n\n${nota.tags ?? ""}`.trim();
      const partes: string[] = [];
      for (let i = 0; i < cuerpoCompleto.length; i += TELE_MAX) {
        partes.push(cuerpoCompleto.slice(i, i + TELE_MAX));
      }
      for (const parte of partes) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: parte, parse_mode: "Markdown" }),
        });
      }

      // Entrar en modo esperando edición
      esperandoEdicion.set(chatId, noticiaId);

      // Auto-limpiar el estado después de 10 minutos
      setTimeout(() => {
        if (esperandoEdicion.get(chatId) === noticiaId) {
          esperandoEdicion.delete(chatId);
        }
      }, 10 * 60 * 1000);

      // Instrucciones para el usuario — token de un solo uso para entrar directo al redactor
      const dominioEdit = process.env.TELEGRAM_WEBHOOK_DOMAIN ?? "riverplateisrael.com";
      const editToken = await createEditToken(noticiaId);
      const editUrl = `\n\n🌐 O editá con foto en: https://${dominioEdit}/redactor?editar=${noticiaId}&edit_token=${editToken}`;

      await enviarMensajeTelegram(
        token, chatId,
        `✏️ *Modo edición activo* (10 min)\n\nCopiá el texto de arriba, modificalo y envialo acá.\nEl sistema lo guardará como Versión Final y te mostrará los botones para publicar.${editUrl}`
      );

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
      const texto = msg.text.trim();
      const textoLower = texto.toLowerCase();

      // /noticia y /noticias (singular y plural) → mostrar pendiente o buscar nueva
      if (textoLower.startsWith("/noticia")) {
        setImmediate(() => {
          handleComandoNoticia(token, fromChatId).catch((err) =>
            logger.error({ err }, "Telegram /noticia: error asíncrono")
          );
        });
        return;
      }

      // /buscar → buscar nueva noticia en medios
      if (textoLower.startsWith("/buscar")) {
        setImmediate(() => {
          handleComandoBuscar(token, fromChatId).catch((err) =>
            logger.error({ err }, "Telegram /buscar: error asíncrono")
          );
        });
        return;
      }

      if (textoLower.startsWith("/ping")) {
        setImmediate(() => {
          enviarMensajeTelegram(token, fromChatId,
            `🏟️ *PONG* — Bot vivo ✅\n\n` +
            `*Comandos disponibles:*\n` +
            `/noticias — Ver nota pendiente o buscar una nueva\n` +
            `/buscar — Escanear medios y generar nota nueva\n` +
            `/ping — Estado del bot`
          ).catch(() => {});
        });
        return;
      }

      // ── Recibir texto editado (Versión Final) ────────────────────────
      if (esperandoEdicion.has(fromChatId)) {
        const noticiaId = esperandoEdicion.get(fromChatId)!;
        esperandoEdicion.delete(fromChatId);

        setImmediate(() => {
          procesarTextoEditado(token, fromChatId, noticiaId, texto).catch((err) =>
            logger.error({ err }, "Telegram: error procesando texto editado")
          );
        });
        return;
      }

      // ── Si esperaba foto y manda texto, cancelar la espera ───────────
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
