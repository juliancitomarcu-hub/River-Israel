/**
 * Registro y diagnóstico de los webhooks de Telegram (River / Selección).
 *
 * Centraliza dos cosas para reusarlas entre el arranque del servidor
 * (`index.ts`) y el panel del redactor (`routes/redactor.ts`):
 *
 *  1. `registrarWebhook(categoria)` — registra (o re-registra) el webhook de un
 *     bot con su `secret_token` determinístico, y recuerda en memoria el
 *     resultado del último intento de ESTE proceso.
 *
 *  2. `consultarWebhookInfo(categoria)` — pega contra `getWebhookInfo` de
 *     Telegram para ver, en vivo, si el webhook está registrado con la URL
 *     esperada y si hay errores de entrega.
 *
 * Nota importante sobre el secret: Telegram NO expone el `secret_token` en
 * `getWebhookInfo` (lo omite por seguridad). Por eso no se puede leer
 * directamente si un webhook quedó protegido. La señal de protección que
 * mostramos combina:
 *   - la URL registrada en vivo (de `getWebhookInfo`) coincide con la esperada, y
 *   - este proceso registró el webhook CON secret en su último intento exitoso.
 * Si el registro de arranque falló (fallo de red, token ausente), el último
 * intento queda marcado como no-protegido y el panel lo avisa.
 */

import { logger } from "./logger";
import { webhookSecretParaToken } from "./telegram-webhook-secret";
import type { CategoriaTelegram } from "./telegram-cred";

/** Ruta del webhook entrante por categoría (debe coincidir con app.ts). */
const RUTAS: Record<CategoriaTelegram, string> = {
  river: "/api/telegram-webhook",
  seleccion: "/api/telegram-webhook-seleccion",
};

/** Resultado del último intento de registro hecho por ESTE proceso. */
export interface RegistroWebhookEstado {
  /** Hubo al menos un intento de registro en este proceso. */
  intentado: boolean;
  /** El último intento registró el webhook exitosamente. */
  ok: boolean;
  /** El último intento exitoso incluyó un secret_token. */
  conSecret: boolean;
  /** URL que se intentó registrar (sin secret), o null si no se intentó. */
  url: string | null;
  /** Motivo del fallo del último intento, o null. */
  error: string | null;
  /** Momento del último intento (ISO), o null. */
  cuando: string | null;
}

function estadoVacio(): RegistroWebhookEstado {
  return { intentado: false, ok: false, conSecret: false, url: null, error: null, cuando: null };
}

const estados: Record<CategoriaTelegram, RegistroWebhookEstado> = {
  river: estadoVacio(),
  seleccion: estadoVacio(),
};

/** Devuelve el estado del último intento de registro de este proceso. */
export function estadoRegistro(categoria: CategoriaTelegram): RegistroWebhookEstado {
  return estados[categoria];
}

function tokenDe(categoria: CategoriaTelegram): string | undefined {
  return categoria === "seleccion"
    ? process.env.TELEGRAM_TOKEN_SELECCION
    : process.env.TELEGRAM_TOKEN;
}

/**
 * Dominio público al que apuntan los webhooks. En producción es
 * TELEGRAM_WEBHOOK_DOMAIN; en dev cae a REPLIT_DEV_DOMAIN.
 */
export function dominioWebhook(): string | undefined {
  return process.env.TELEGRAM_WEBHOOK_DOMAIN ?? process.env.REPLIT_DEV_DOMAIN;
}

/**
 * Registra (o re-registra) el webhook de un bot con su secret_token.
 * Actualiza y devuelve el estado en memoria del último intento.
 */
export async function registrarWebhook(
  categoria: CategoriaTelegram,
): Promise<RegistroWebhookEstado> {
  const token = tokenDe(categoria);
  const cuando = new Date().toISOString();

  if (!token) {
    estados[categoria] = {
      intentado: true,
      ok: false,
      conSecret: false,
      url: null,
      error: categoria === "seleccion"
        ? "Falta TELEGRAM_TOKEN_SELECCION"
        : "Falta TELEGRAM_TOKEN",
      cuando,
    };
    return estados[categoria];
  }

  const domain = dominioWebhook();
  if (!domain) {
    estados[categoria] = {
      intentado: true,
      ok: false,
      conSecret: false,
      url: null,
      error: "No hay dominio para el webhook (falta TELEGRAM_WEBHOOK_DOMAIN)",
      cuando,
    };
    return estados[categoria];
  }

  const webhookUrl = `https://${domain}${RUTAS[categoria]}`;
  const secretToken = webhookSecretParaToken(token);

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"],
        ...(secretToken ? { secret_token: secretToken } : {}),
      }),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (data.ok) {
      logger.info({ bot: categoria, webhookUrl }, "Webhook de Telegram registrado exitosamente");
      estados[categoria] = {
        intentado: true,
        ok: true,
        conSecret: !!secretToken,
        url: webhookUrl,
        error: null,
        cuando,
      };
    } else {
      logger.warn({ bot: categoria, data }, "No se pudo registrar el webhook de Telegram");
      estados[categoria] = {
        intentado: true,
        ok: false,
        conSecret: false,
        url: webhookUrl,
        error: data.description ?? "Telegram rechazó el registro",
        cuando,
      };
    }
  } catch (err) {
    logger.error({ bot: categoria, err }, "Error registrando webhook de Telegram");
    estados[categoria] = {
      intentado: true,
      ok: false,
      conSecret: false,
      url: webhookUrl,
      error: "No se pudo conectar con Telegram",
      cuando,
    };
  }

  return estados[categoria];
}

/** Estado en vivo del webhook según getWebhookInfo de Telegram. */
export interface WebhookInfoVivo {
  /** Pudimos consultar getWebhookInfo (independiente de si hay webhook). */
  consultaOk: boolean;
  /** Motivo por el que falló la consulta, o null. */
  errorConsulta: string | null;
  /** Hay un webhook registrado (url no vacía). */
  registrado: boolean;
  /** URL que Telegram reporta como registrada, o null. */
  url: string | null;
  /** URL que esperamos según el dominio configurado, o null si no hay dominio. */
  urlEsperada: string | null;
  /** La URL registrada coincide con la esperada. */
  urlCoincide: boolean;
  /** Updates pendientes encolados en Telegram. */
  pendingUpdateCount: number | null;
  /** Último error de entrega que reporta Telegram, o null. */
  ultimoError: string | null;
}

/** Consulta getWebhookInfo de Telegram para un bot. */
export async function consultarWebhookInfo(
  categoria: CategoriaTelegram,
): Promise<WebhookInfoVivo> {
  const token = tokenDe(categoria);
  const domain = dominioWebhook();
  const urlEsperada = domain ? `https://${domain}${RUTAS[categoria]}` : null;

  const base: WebhookInfoVivo = {
    consultaOk: false,
    errorConsulta: null,
    registrado: false,
    url: null,
    urlEsperada,
    urlCoincide: false,
    pendingUpdateCount: null,
    ultimoError: null,
  };

  if (!token) {
    return { ...base, errorConsulta: categoria === "seleccion" ? "Falta TELEGRAM_TOKEN_SELECCION" : "Falta TELEGRAM_TOKEN" };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = (await res.json()) as {
      ok: boolean;
      description?: string;
      result?: {
        url?: string;
        pending_update_count?: number;
        last_error_message?: string;
      };
    };
    if (!data.ok || !data.result) {
      return { ...base, errorConsulta: data.description ?? "Telegram rechazó la consulta" };
    }
    const url = data.result.url && data.result.url.length > 0 ? data.result.url : null;
    return {
      ...base,
      consultaOk: true,
      registrado: !!url,
      url,
      urlCoincide: !!url && !!urlEsperada && url === urlEsperada,
      pendingUpdateCount: data.result.pending_update_count ?? null,
      ultimoError: data.result.last_error_message ?? null,
    };
  } catch (err) {
    logger.warn({ bot: categoria, err }, "Error consultando getWebhookInfo de Telegram");
    return { ...base, errorConsulta: "No se pudo conectar con Telegram" };
  }
}

/**
 * Resumen combinado para el panel: estado en vivo (getWebhookInfo) + si este
 * proceso registró el webhook con secret. `protegido` es true sólo si el
 * webhook está registrado con la URL esperada Y el último registro incluyó
 * secret.
 */
export interface WebhookEstadoPanel extends WebhookInfoVivo {
  categoria: CategoriaTelegram;
  /** El último intento de registro de este proceso incluyó secret y fue ok. */
  registradoConSecret: boolean;
  /** Está realmente protegido (registrado + url esperada + con secret). */
  protegido: boolean;
}

export async function estadoWebhookPanel(
  categoria: CategoriaTelegram,
): Promise<WebhookEstadoPanel> {
  const vivo = await consultarWebhookInfo(categoria);
  const reg = estadoRegistro(categoria);
  const registradoConSecret = reg.ok && reg.conSecret;
  const protegido = vivo.registrado && vivo.urlCoincide && registradoConSecret;
  return { categoria, ...vivo, registradoConSecret, protegido };
}
