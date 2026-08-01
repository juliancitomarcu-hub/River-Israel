import app from "./app";
import { logger } from "./lib/logger";
import { iniciarScheduler } from "./scheduler";
import { registrarWebhook, fallaReintentable, type RegistroWebhookEstado } from "./lib/telegram-webhook-registro";
import { avisarSiWebhookSinProteger, avisarWebhookRecuperado } from "./lib/avisar-webhook-sin-proteger";
import type { CategoriaTelegram } from "./lib/telegram-cred";
import { initRedactorSettings } from "./lib/redactor-settings";

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

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Esperas antes de cada reintento (backoff creciente). */
const ESPERAS_REINTENTO_MS = [5_000, 15_000, 45_000];

/**
 * Registra el webhook de un bot con reintentos y backoff creciente ante
 * fallos transitorios. El aviso de Telegram se envía solo si todos los
 * intentos fallan; si un reintento posterior tiene éxito, se avisa que se
 * recuperó solo.
 */
async function registrarWebhookConReintentos(categoria: CategoriaTelegram): Promise<void> {
  let estado = await registrarWebhook(categoria);

  if (fallaReintentable(estado)) {
    for (let i = 0; i < ESPERAS_REINTENTO_MS.length; i++) {
      const esperaMs = ESPERAS_REINTENTO_MS[i]!;
      const intento = i + 2; // el intento 1 fue el inicial
      logger.warn(
        { bot: categoria, error: estado.error, intento, esperaMs },
        "Registro de webhook falló; reintentando con backoff",
      );
      await esperar(esperaMs);
      estado = await registrarWebhook(categoria);
      if (!fallaReintentable(estado)) {
        if (estado.ok) {
          avisarWebhookRecuperado(categoria, intento);
        }
        break;
      }
    }
  }

  // Avisa solo si el estado final quedó sin proteger (todos los reintentos
  // fallaron, o falla no reintentable como token/dominio ausente o sin secret).
  avisarSiWebhookSinProteger(categoria, estado);
}

async function registrarWebhookTelegram() {
  // Solo registrar el webhook en producción para no sobreescribir el webhook de prod desde dev
  if (!esProduccion) {
    logger.info("Modo desarrollo: registro de webhook de Telegram omitido (evita sobreescribir producción)");
    return;
  }

  // Registra cada bot con su secret_token y reintentos ante fallos
  // transitorios. El módulo recuerda el resultado del último intento en
  // memoria para que el panel pueda avisar si quedó sin proteger.
  await registrarWebhookConReintentos("river");
  await registrarWebhookConReintentos("seleccion");
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

  // Hidratar settings desde la DB antes de arrancar el scheduler para que el
  // primer ciclo no use defaults por una carrera de arranque.
  initRedactorSettings()
    .catch((err) => {
      logger.error({ err }, "Error hidratando redactor settings desde la DB");
    })
    .finally(() => {
      if (esProduccion) {
        iniciarScheduler();
      } else {
        logger.info("Modo desarrollo: scheduler automático desactivado (solo corre en producción)");
      }
    });
});
