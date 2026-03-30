import app from "./app";
import { logger } from "./lib/logger";
import { iniciarScheduler } from "./scheduler";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Detectar producción por NODE_ENV o por TELEGRAM_WEBHOOK_DOMAIN (que solo existe en prod)
const esProduccion = process.env.NODE_ENV === "production" || !!process.env.TELEGRAM_WEBHOOK_DOMAIN;

async function registrarWebhookTelegram() {
  // Solo registrar el webhook en producción para no sobreescribir el webhook de prod desde dev
  if (!esProduccion) {
    logger.info("Modo desarrollo: registro de webhook de Telegram omitido (evita sobreescribir producción)");
    return;
  }

  const token = process.env.TELEGRAM_TOKEN;
  // TELEGRAM_WEBHOOK_DOMAIN tiene prioridad (dominio de producción real: riverplatisrael.replit.app)
  const domain = process.env.TELEGRAM_WEBHOOK_DOMAIN ?? process.env.REPLIT_DEV_DOMAIN;

  if (!token || !domain) {
    logger.warn("No se puede registrar webhook: falta TELEGRAM_TOKEN o dominio");
    return;
  }

  const webhookUrl = `https://${domain}/api/telegram-webhook`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"],
      }),
    });
    const data = await res.json() as { ok: boolean; description?: string };
    if (data.ok) {
      logger.info({ webhookUrl }, "Webhook de Telegram registrado exitosamente");
    } else {
      logger.warn({ data }, "No se pudo registrar el webhook de Telegram");
    }
  } catch (err) {
    logger.error({ err }, "Error registrando webhook de Telegram");
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  registrarWebhookTelegram().catch((err) => {
    logger.error({ err }, "Error en registro de webhook");
  });

  if (esProduccion) {
    iniciarScheduler();
  } else {
    logger.info("Modo desarrollo: scheduler automático desactivado (solo corre en producción)");
  }
});
