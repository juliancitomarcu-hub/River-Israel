import app from "./app";
import { logger } from "./lib/logger";
import { iniciarScheduler } from "./scheduler";
import { registrarWebhook } from "./lib/telegram-webhook-registro";
import { avisarSiWebhookSinProteger } from "./lib/avisar-webhook-sin-proteger";

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

  // Registra cada bot con su secret_token. El módulo recuerda el resultado del
  // intento en memoria para que el panel pueda avisar si quedó sin proteger.
  const estadoRiver = await registrarWebhook("river");
  avisarSiWebhookSinProteger("river", estadoRiver);
  const estadoSeleccion = await registrarWebhook("seleccion");
  avisarSiWebhookSinProteger("seleccion", estadoSeleccion);
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
