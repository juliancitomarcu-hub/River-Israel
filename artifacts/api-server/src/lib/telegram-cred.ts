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

export type CategoriaTelegram = "river" | "seleccion";

export interface CredencialTelegram {
  token: string;
  chatId: string;
  /** Marca editorial para encabezados de mensajes. */
  marca: string;
}

/**
 * Devuelve el par token/chat correspondiente a la categoría, o `null` si ese
 * bot no está configurado (faltan las variables de entorno). El llamador decide
 * cómo avisar (responder/loguear) cuando es `null`.
 */
export function credencialesTelegram(
  categoria: CategoriaTelegram,
): CredencialTelegram | null {
  if (categoria === "seleccion") {
    const token = process.env.TELEGRAM_TOKEN_SELECCION;
    const chatId = process.env.TELEGRAM_CHAT_SELECCION;
    if (!token || !chatId) return null;
    return { token, chatId, marca: "La Scaloneta en Israel" };
  }

  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return null;
  return { token, chatId, marca: "River en Israel" };
}
