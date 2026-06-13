/**
 * Secret token para validar que los webhooks entrantes vengan realmente de
 * Telegram.
 *
 * Telegram permite registrar un `secret_token` al llamar a setWebhook; luego
 * envía ese valor en el header `X-Telegram-Bot-Api-Secret-Token` en cada POST.
 * Validándolo rechazamos cualquier request de terceros que intente disparar
 * búsquedas o publicaciones contra nuestros endpoints.
 *
 * El secret se deriva de forma determinística del token del bot:
 *   - No requiere variables de entorno adicionales.
 *   - River y Selección obtienen secrets distintos automáticamente (sus tokens
 *     difieren), tanto al registrar como al validar.
 *   - El mismo valor se calcula en index.ts (registro) y en el webhook
 *     (validación) a partir del token que ya vive en el entorno.
 *
 * El formato cumple la restricción de Telegram (1–256 chars de `A-Z a-z 0-9 _ -`).
 */

import { createHmac } from "node:crypto";

const SECRET_NAMESPACE = "river-en-israel:telegram-webhook";

/**
 * Devuelve el secret_token determinístico para un bot dado su token de Telegram.
 * Retorna `null` si no hay token (bot no configurado).
 */
export function webhookSecretParaToken(botToken: string | undefined): string | null {
  if (!botToken) return null;
  return createHmac("sha256", botToken).update(SECRET_NAMESPACE).digest("hex");
}
