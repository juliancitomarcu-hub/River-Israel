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

async function registrarUnWebhook(bot: string, token: string, domain: string, ruta: string) {
  const webhookUrl = `https://${domain}${ruta}`;
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
      logger.info({ bot, webhookUrl }, "Webhook de Telegram registrado exitosamente");
    } else {
      logger.warn({ bot, data }, "No se pudo registrar el webhook de Telegram");
    }
  } catch (err) {
    logger.error({ bot, err }, "Error registrando webhook de Telegram");
  }
}

async function registrarWebhookTelegram() {
  // Solo registrar el webhook en producción para no sobreescribir el webhook de prod desde dev
  if (!esProduccion) {
    logger.info("Modo desarrollo: registro de webhook de Telegram omitido (evita sobreescribir producción)");
    return;
  }

  // TELEGRAM_WEBHOOK_DOMAIN tiene prioridad (dominio de producción real: riverplatisrael.replit.app)
  const domain = process.env.TELEGRAM_WEBHOOK_DOMAIN ?? process.env.REPLIT_DEV_DOMAIN;
  if (!domain) {
    logger.warn("No se puede registrar webhook: falta el dominio");
    return;
  }

  // Bot de River — bot principal.
  const tokenRiver = process.env.TELEGRAM_TOKEN;
  if (tokenRiver) {
    await registrarUnWebhook("river", tokenRiver, domain, "/api/telegram-webhook");
  } else {
    logger.warn("No se puede registrar webhook de River: falta TELEGRAM_TOKEN");
  }

  // Bot de la Selección ("La Scaloneta en Israel") — bot dedicado.
  const tokenSeleccion = process.env.TELEGRAM_TOKEN_SELECCION;
  if (tokenSeleccion) {
    await registrarUnWebhook("seleccion", tokenSeleccion, domain, "/api/telegram-webhook-seleccion");
  } else {
    logger.warn("No se registra webhook de Selección: falta TELEGRAM_TOKEN_SELECCION");
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
