---
name: Telegram webhook secret no es legible
description: getWebhookInfo de Telegram NO devuelve el secret_token; cómo verificar protección del webhook.
---

# Telegram getWebhookInfo no expone el secret_token

`getWebhookInfo` de Telegram devuelve `url`, `pending_update_count`,
`last_error_message`, etc., pero **NUNCA** el `secret_token` (lo omite por
seguridad). Por lo tanto no se puede leer directamente "si el webhook está
protegido" solo consultando Telegram.

**Cómo verificamos protección en el panel del redactor:** combinamos dos señales
- URL en vivo de `getWebhookInfo` coincide con la URL esperada (dominio actual), y
- este proceso registró el webhook CON secret en su último intento exitoso
  (registro en memoria, no persiste entre reinicios).

`protegido = registrado && urlCoincide && registradoConSecret`.

**Why:** el secret solo se setea al arrancar en producción (setWebhook). Si ese
registro falla (red/token), el webhook queda sin secret y no hay forma de
detectarlo desde Telegram — solo desde nuestro propio registro en memoria.

**How to apply:** en dev `urlEsperada` usa REPLIT_DEV_DOMAIN mientras el webhook
real apunta a producción, así que `protegido` será false en dev (esperado). El
botón "Re-registrar con secret" re-ejecuta setWebhook y refresca el estado.
