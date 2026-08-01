import app from "./app";
import { logger } from "./lib/logger";
import { iniciarScheduler } from "./scheduler";
import { registrarWebhook, fallaReintentable, consultarWebhookInfo, type RegistroWebhookEstado } from "./lib/telegram-webhook-registro";
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

const INTERVALO_CHEQUEO_WEBHOOK_MS = 2 * 60 * 60 * 1000; // 2 horas
const PRIMER_CHEQUEO_WEBHOOK_MS    = 90 * 60 * 1000;     // 90 min tras arrancar

/**
 * Consulta el estado en vivo del webhook de un bot y, si la URL registrada en
 * Telegram no coincide con la URL esperada (o no hay webhook), lo re-registra
 * automáticamente con los mismos reintentos y backoff del arranque.
 * El aviso por Telegram sale solo si la auto-recuperación falla.
 */
async function chequearYRecuperarWebhook(categoria: CategoriaTelegram): Promise<void> {
  let info;
  try {
    info = await consultarWebhookInfo(categoria);
  } catch (err) {
    logger.warn({ bot: categoria, err }, "Chequeo periódico de webhook: error consultando getWebhookInfo");
    return;
  }

  if (!info.consultaOk) {
    logger.warn({ bot: categoria, error: info.errorConsulta }, "Chequeo periódico de webhook: no se pudo consultar getWebhookInfo");
    return;
  }

  if (info.urlCoincide) {
    logger.info({ bot: categoria, url: info.url }, "Chequeo periódico de webhook: OK, URL coincide");
    return;
  }

  logger.warn(
    { bot: categoria, urlActual: info.url ?? "(vacía)", urlEsperada: info.urlEsperada },
    "Chequeo periódico de webhook: URL no coincide con la esperada, re-registrando automáticamente",
  );

  await registrarWebhookConReintentos(categoria);
}

function iniciarChequeoPeriodicoWebhook(): void {
  logger.info(
    { primerChequeoMinutos: 90, intervaloHoras: 2 },
    "Chequeo periódico de webhook: iniciado — primer chequeo en 90 min, luego cada 2 horas",
  );

  const ejecutarChequeo = (): void => {
    (["river", "seleccion"] as CategoriaTelegram[]).forEach((cat) => {
      chequearYRecuperarWebhook(cat).catch((err) =>
        logger.error({ err, bot: cat }, "Chequeo periódico de webhook: error inesperado"),
      );
    });
  };

  setTimeout(() => {
    ejecutarChequeo();
    setInterval(ejecutarChequeo, INTERVALO_CHEQUEO_WEBHOOK_MS);
  }, PRIMER_CHEQUEO_WEBHOOK_MS);
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

  registrarWebhookTelegram()
    .catch((err) => {
      logger.error({ err }, "Error en registro de webhook");
    })
    .finally(() => {
      if (esProduccion) {
        iniciarChequeoPeriodicoWebhook();
      }
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
