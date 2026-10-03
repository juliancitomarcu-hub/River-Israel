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

/** Marca editorial (nombre del bot) por categoría. */
const MARCAS: Record<CategoriaTelegram, string> = {
  river: "River en Israel",
  seleccion: "La Scaloneta en Israel",
};

/** Estado de configuración de un bot, para mostrar en el panel del redactor. */
export interface EstadoBotTelegram {
  categoria: CategoriaTelegram;
  /** Nombre del bot / marca editorial. */
  marca: string;
  /** true si el bot tiene token + chat válidos y está listo para enviar. */
  configurado: boolean;
  /** Falta la variable de token. */
  faltaToken: boolean;
  /** Falta la variable de chat. */
  faltaChat: boolean;
  /** El chat_id está presente pero no es numérico válido. */
  chatInvalido: boolean;
}

function leerVars(categoria: CategoriaTelegram): { token?: string; chatId?: string } {
  if (categoria === "seleccion") {
    return {
      token: process.env.TELEGRAM_TOKEN_SELECCION,
      chatId: process.env.TELEGRAM_CHAT_SELECCION,
    };
  }
  return {
    token: process.env.TELEGRAM_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  };
}

/**
 * Reporta el estado de configuración de un bot sin loguear ni exponer valores
 * sensibles. Pensado para que el panel del redactor muestre, de un vistazo, si
 * cada bot (River / Selección) está listo o le falta token/chat.
 */
export function estadoTelegram(categoria: CategoriaTelegram): EstadoBotTelegram {
  const { token, chatId } = leerVars(categoria);
  const faltaToken = !token;
  const faltaChat = !chatId;
  const chatInvalido = !!chatId && !chatIdValido(chatId);
  return {
    categoria,
    marca: MARCAS[categoria],
    configurado: !faltaToken && !faltaChat && !chatInvalido,
    faltaToken,
    faltaChat,
    chatInvalido,
  };
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
