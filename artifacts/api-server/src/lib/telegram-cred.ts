/**
 * Selección de credenciales de Telegram por categoría.
 *
 * River usa el bot principal (TELEGRAM_TOKEN / TELEGRAM_CHAT_ID).
 * La Selección Argentina ("La Scaloneta en Israel") usa su propio bot
 * (TELEGRAM_TOKEN_SELECCION / TELEGRAM_CHAT_SELECCION).
 *
 * Centralizado acá para reusarlo en el envío manual (redactor), el scheduler
 * automático y los webhooks entrantes.
 */

import { logger } from "./logger";

export type CategoriaTelegram = "river" | "seleccion";

export interface CredencialTelegram {
  token: string;
  chatId: string;
  /** Marca editorial para encabezados de mensajes. */
  marca: string;
}

/**
 * Un chat_id de Telegram es siempre numérico (positivo para usuarios, negativo
 * para grupos/canales). Un token tiene la forma `<botId>:<authString>`. Si
 * alguien confunde las variables y mete un token donde va el chat, fallamos
 * rápido en vez de pegarle a la API con un chat_id inválido.
 */
function chatIdValido(chatId: string): boolean {
  return /^-?\d+$/.test(chatId.trim());
}

/**
 * Devuelve el par token/chat correspondiente a la categoría, o `null` si ese
 * bot no está configurado (faltan las variables de entorno) o si el chat_id
 * tiene un formato inválido. El llamador decide cómo avisar (responder/loguear)
 * cuando es `null`.
 */
export function credencialesTelegram(
  categoria: CategoriaTelegram,
): CredencialTelegram | null {
  if (categoria === "seleccion") {
    const token = process.env.TELEGRAM_TOKEN_SELECCION;
    const chatId = process.env.TELEGRAM_CHAT_SELECCION;
    if (!token || !chatId) return null;
    if (!chatIdValido(chatId)) {
      logger.warn(
        "credencialesTelegram: TELEGRAM_CHAT_SELECCION no es un chat_id numérico válido (¿se cargó un token por error?). Bot de Selección desactivado.",
      );
      return null;
    }
    return { token, chatId, marca: "La Scaloneta en Israel" };
  }

  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return null;
  if (!chatIdValido(chatId)) {
    logger.warn(
      "credencialesTelegram: TELEGRAM_CHAT_ID no es un chat_id numérico válido. Bot de River desactivado.",
    );
    return null;
  }
  return { token, chatId, marca: "River en Israel" };
}
