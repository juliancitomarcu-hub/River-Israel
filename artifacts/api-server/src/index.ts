import app from "./app";
import { logger } from "./lib/logger";

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

async function registrarWebhookTelegram() {
  const token = process.env.TELEGRAM_TOKEN;
  const domain = process.env.REPLIT_DEV_DOMAIN;

  if (!token || !domain) {
    logger.warn("No se puede registrar webhook: falta TELEGRAM_TOKEN o REPLIT_DEV_DOMAIN");
    return;
  }

  const webhookUrl = `https://${domain}/api/telegram-webhook`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
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
});
