/**
 * Aviso de Telegram cuando la cola de updates pendientes de un bot supera
 * un umbral de forma sostenida.
 *
 * Telegram encola los updates que no pudo entregar al webhook. Si la cola
 * crece en silencio, al recuperarse el bot procesará acciones tardías de
 * golpe. Este módulo detecta ese escenario y avisa proactivamente para que
 * el redactor pueda descartar los pendientes a tiempo con el botón del panel.
 *
 * Lógica:
 *  - `chequearColaUpdates(categoria)` consulta `getWebhookInfo` y mide cuánto
 *    tiempo lleva `pending_update_count` por encima del umbral en esta racha.
 *  - Solo avisa si la cola lleva más de VENTANA_SOSTENIDA_MS alta; una subida
 *    momentánea no dispara el aviso.
 *  - No spam: hay un cooldown de THROTTLE_MS entre avisos del mismo bot.
 *  - Fire-and-forget: nunca bloquea ni rompe el chequeo periódico.
 */

import { logger } from "./logger";
import { credencialesTelegram, type CategoriaTelegram } from "./telegram-cred";
import { consultarWebhookInfo, dominioWebhook } from "./telegram-webhook-registro";

/** Umbral de updates pendientes a partir del cual se activa el seguimiento. */
const UMBRAL_UPDATES = 10;

/**
 * Tiempo mínimo que la cola debe permanecer por encima del umbral antes de
 * enviar el aviso. Evita falsas alarmas por picos momentáneos.
 */
const VENTANA_SOSTENIDA_MS = 5 * 60 * 1000; // 5 minutos

/** Cooldown entre avisos del mismo bot para no inundar el chat. */
const THROTTLE_MS = 30 * 60 * 1000; // 30 minutos

const NOMBRES: Record<CategoriaTelegram, string> = {
  river: "River en Israel",
  seleccion: "La Scaloneta en Israel",
};

/** Escapa caracteres especiales de Markdown (v1) de Telegram. */
function escaparMarkdown(s: string): string {
  return s.replace(/([_*`\[])/g, "\\$1");
}

/** Estado de seguimiento de la cola por bot. */
interface EstadoCola {
  /** Momento en que la cola superó el umbral por primera vez (en la racha actual). */
  altoDesde: number | null;
  /** Momento del último aviso enviado, o null si nunca se avisó en este proceso. */
  ultimoAviso: number | null;
}

const estadosPorBot: Record<CategoriaTelegram, EstadoCola> = {
  river: { altoDesde: null, ultimoAviso: null },
  seleccion: { altoDesde: null, ultimoAviso: null },
};

/** Construye el texto del aviso. */
function textoAviso(
  categoria: CategoriaTelegram,
  pendingCount: number,
  minutosSostenido: number,
  viaControl: boolean,
): string {
  const nombre = escaparMarkdown(NOMBRES[categoria]);
  const dominio = dominioWebhook();
  const linkPanel = dominio ? `https://${dominio}/redactor` : null;
  const textoPanel = linkPanel
    ? `🔧 _Podés descartar la cola desde el panel del redactor:_\n${linkPanel}`
    : `🔧 _Podés descartar la cola desde el panel del redactor \\(/redactor\\)\\._`;
  return (
    `⚠️ *Cola de updates acumulada*\n\n` +
    `🤖 Bot: *${nombre}*\n` +
    `📬 Pendientes: *${pendingCount} updates* sin entregar\n` +
    `⏱ Lleva más de ${minutosSostenido} minuto${minutosSostenido !== 1 ? "s" : ""} acumulándose\\.\n\n` +
    (viaControl
      ? `📣 _Aviso enviado al canal de control \\(River\\) porque el bot afectado no pudo enviar\\._ \n\n`
      : "") +
    textoPanel
  );
}

/** Intenta un sendMessage; devuelve true si Telegram aceptó el mensaje. */
async function enviarMensaje(
  cred: { token: string; chatId: string },
  texto: string,
  contexto: Record<string, unknown>,
): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${cred.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: cred.chatId, text: texto, parse_mode: "Markdown" }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn({ ...contexto, status: res.status, body }, "avisarColaUpdates: Telegram respondió con error HTTP");
      return false;
    }
    let data: { ok?: boolean; error_code?: number; description?: string };
    try {
      data = (await res.json()) as typeof data;
    } catch {
      logger.warn({ ...contexto, status: res.status }, "avisarColaUpdates: respuesta de Telegram no es JSON válido");
      return false;
    }
    if (data.ok !== true) {
      logger.warn(
        { ...contexto, errorCode: data.error_code ?? null, description: data.description ?? null },
        "avisarColaUpdates: Telegram rechazó el envío",
      );
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ ...contexto, err }, "avisarColaUpdates: fallo de red enviando aviso");
    return false;
  }
}

/**
 * Envía el aviso al bot afectado; si no tiene credenciales o el envío falla,
 * reintenta por el canal de control (River).
 */
async function enviarConFallback(
  categoria: CategoriaTelegram,
  pendingCount: number,
  minutosSostenido: number,
): Promise<void> {
  const credPropia = credencialesTelegram(categoria);

  if (credPropia) {
    const ok = await enviarMensaje(
      credPropia,
      textoAviso(categoria, pendingCount, minutosSostenido, false),
      { bot: categoria, via: "bot afectado" },
    );
    if (ok || categoria === "river") return;
    logger.warn(
      { bot: categoria },
      "avisarColaUpdates: el bot afectado no pudo enviar; reintentando por el canal de control (River)",
    );
  } else if (categoria === "river") {
    logger.warn({ bot: categoria }, "avisarColaUpdates: sin credenciales para enviar el aviso");
    return;
  }

  const credControl = credencialesTelegram("river");
  if (!credControl) {
    logger.warn(
      { bot: categoria },
      "avisarColaUpdates: tampoco hay credenciales del canal de control (River); aviso perdido",
    );
    return;
  }

  const okControl = await enviarMensaje(
    credControl,
    textoAviso(categoria, pendingCount, minutosSostenido, true),
    { bot: categoria, via: "canal de control (River)" },
  );
  if (okControl) {
    logger.info({ bot: categoria }, "avisarColaUpdates: aviso entregado por el canal de control (River)");
  } else {
    logger.warn({ bot: categoria }, "avisarColaUpdates: el aviso falló también por el canal de control (River)");
  }
}

/**
 * Consulta `pending_update_count` de un bot y avisa por Telegram si la cola
 * lleva más de VENTANA_SOSTENIDA_MS por encima del umbral.
 *
 * Diseñado para llamarse periódicamente. Es fire-and-forget: el llamador
 * puede envolver la llamada en `.catch()` para ignorar errores inesperados.
 */
export async function chequearColaUpdates(categoria: CategoriaTelegram): Promise<void> {
  let info;
  try {
    info = await consultarWebhookInfo(categoria);
  } catch (err) {
    logger.warn({ bot: categoria, err }, "chequearColaUpdates: error consultando getWebhookInfo");
    return;
  }

  if (!info.consultaOk || info.pendingUpdateCount === null) {
    // No se pudo consultar; no se toca el estado de seguimiento para no
    // resetear falsamente una racha en curso.
    return;
  }

  const estado = estadosPorBot[categoria];
  const ahora = Date.now();
  const count = info.pendingUpdateCount;

  if (count <= UMBRAL_UPDATES) {
    // Cola bajo control: reiniciar racha.
    if (estado.altoDesde !== null) {
      logger.info(
        { bot: categoria, count, umbral: UMBRAL_UPDATES },
        "chequearColaUpdates: cola bajó del umbral, racha reiniciada",
      );
      estado.altoDesde = null;
    }
    return;
  }

  // Cola por encima del umbral.
  if (estado.altoDesde === null) {
    estado.altoDesde = ahora;
    logger.info(
      { bot: categoria, count, umbral: UMBRAL_UPDATES },
      "chequearColaUpdates: cola superó el umbral, iniciando seguimiento",
    );
    return;
  }

  const tiempoAltoMs = ahora - estado.altoDesde;
  if (tiempoAltoMs < VENTANA_SOSTENIDA_MS) {
    // Aún no se cumplió la ventana sostenida; seguir esperando.
    return;
  }

  // Throttle: no spamear si ya avisamos hace poco.
  if (estado.ultimoAviso !== null && ahora - estado.ultimoAviso < THROTTLE_MS) {
    const minRestantes = Math.ceil((THROTTLE_MS - (ahora - estado.ultimoAviso)) / 60_000);
    logger.info(
      { bot: categoria, count, minRestantes },
      "chequearColaUpdates: aviso suprimido por throttle, ya se envió uno hace poco",
    );
    return;
  }

  const minutosSostenido = Math.max(1, Math.round(tiempoAltoMs / 60_000));
  logger.warn(
    { bot: categoria, count, minutosSostenido, umbral: UMBRAL_UPDATES },
    "chequearColaUpdates: cola alta sostenida, enviando aviso a Telegram",
  );
  estado.ultimoAviso = ahora;

  await enviarConFallback(categoria, count, minutosSostenido);
}
