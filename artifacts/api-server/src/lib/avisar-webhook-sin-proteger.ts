/**
 * Aviso de Telegram cuando un webhook queda sin proteger al arrancar.
 *
 * Si `registrarWebhook()` falla o el registro quedó sin secret_token en
 * producción, nadie se entera hasta abrir el panel del redactor. Este módulo
 * cierra el ciclo enviando un mensaje de alerta al chat del bot afectado; si
 * ese bot no puede enviar (token/chat ausente o inválido), cae al chat de
 * River como canal de control.
 *
 * Fire-and-forget: nunca bloquea ni rompe el arranque del servidor.
 */

import { logger } from "./logger";
import { credencialesTelegram, type CategoriaTelegram } from "./telegram-cred";
import type { RegistroWebhookEstado } from "./telegram-webhook-registro";

/** Escapa caracteres especiales de Markdown (v1) de Telegram. */
function escaparMarkdown(s: string): string {
  return s.replace(/([_*`\[])/g, "\\$1");
}

const NOMBRES: Record<CategoriaTelegram, string> = {
  river: "River en Israel",
  seleccion: "La Scaloneta en Israel",
};

/**
 * Revisa el resultado de un intento de registro y, si el webhook quedó sin
 * proteger (falló el registro o quedó sin secret), avisa por Telegram.
 */
export function avisarSiWebhookSinProteger(
  categoria: CategoriaTelegram,
  estado: RegistroWebhookEstado,
): void {
  if (estado.ok && estado.conSecret) return;

  const motivo = !estado.ok
    ? (estado.error ?? "El registro del webhook falló sin detalle")
    : "El webhook quedó registrado pero SIN secret_token";

  logger.warn({ bot: categoria, motivo }, "Webhook sin proteger al arrancar; enviando aviso a Telegram");

  void enviarConFallback(categoria, motivo).catch((err) => {
    logger.warn({ err, bot: categoria }, "avisarSiWebhookSinProteger: fallo inesperado enviando aviso");
  });
}

/** Arma el texto del aviso. */
function textoAviso(categoria: CategoriaTelegram, motivo: string, viaControl: boolean): string {
  return (
    `⚠️ *Webhook de Telegram sin proteger*\n\n` +
    `🤖 Bot: *${escaparMarkdown(NOMBRES[categoria])}*\n` +
    `❗️ Motivo: ${escaparMarkdown(motivo.slice(0, 300))}\n\n` +
    (viaControl ? `📣 _Aviso enviado al canal de control (River) porque el bot afectado no pudo enviar._\n` : "") +
    `🔧 _Revisá el panel del redactor (pestaña de webhooks) para re-registrarlo._`
  );
}

/** Intenta un sendMessage; true si Telegram aceptó el mensaje. */
async function enviarMensaje(
  cred: { token: string; chatId: string },
  texto: string,
  contexto: Record<string, unknown>,
): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${cred.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cred.chatId,
        text: texto,
        parse_mode: "Markdown",
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn({ ...contexto, status: res.status, body }, "avisarSiWebhookSinProteger: Telegram respondió con error HTTP");
      return false;
    }
    // Telegram puede devolver HTTP 200 con { ok: false } para errores
    // funcionales (token revocado, chat inválido, etc.), así que hay que
    // validar el campo `ok` del payload, no solo el status HTTP.
    let data: { ok?: boolean; error_code?: number; description?: string };
    try {
      data = (await res.json()) as typeof data;
    } catch {
      logger.warn({ ...contexto, status: res.status }, "avisarSiWebhookSinProteger: respuesta de Telegram no es JSON válido");
      return false;
    }
    if (data.ok !== true) {
      logger.warn(
        { ...contexto, errorCode: data.error_code ?? null, description: data.description ?? null },
        "avisarSiWebhookSinProteger: Telegram rechazó el envío",
      );
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ ...contexto, err }, "avisarSiWebhookSinProteger: fallo de red enviando aviso a Telegram");
    return false;
  }
}

/**
 * Intenta avisar por el bot afectado; si no tiene credenciales o el envío
 * falla (token revocado, 401, red), reintenta por el chat de River como
 * canal de control.
 */
async function enviarConFallback(categoria: CategoriaTelegram, motivo: string): Promise<void> {
  const credPropia = credencialesTelegram(categoria);

  if (credPropia) {
    const ok = await enviarMensaje(credPropia, textoAviso(categoria, motivo, false), {
      bot: categoria,
      via: "bot afectado",
    });
    if (ok || categoria === "river") return;
    logger.warn({ bot: categoria }, "avisarSiWebhookSinProteger: el bot afectado no pudo enviar; reintentando por el canal de control (River)");
  } else if (categoria === "river") {
    logger.warn({ bot: categoria }, "avisarSiWebhookSinProteger: sin credenciales para enviar el aviso");
    return;
  }

  const credControl = credencialesTelegram("river");
  if (!credControl) {
    logger.warn({ bot: categoria }, "avisarSiWebhookSinProteger: tampoco hay credenciales del canal de control (River); aviso perdido");
    return;
  }

  const okControl = await enviarMensaje(credControl, textoAviso(categoria, motivo, true), {
    bot: categoria,
    via: "canal de control (River)",
  });
  if (okControl) {
    logger.info({ bot: categoria }, "avisarSiWebhookSinProteger: aviso entregado por el canal de control (River)");
  } else {
    logger.warn({ bot: categoria }, "avisarSiWebhookSinProteger: el aviso falló también por el canal de control (River)");
  }
}
