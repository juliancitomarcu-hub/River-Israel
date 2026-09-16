/**
 * "Brazo de marketing": promoción automática de notas publicadas.
 *
 * Cuando una nota queda publicada en el sitio (autopublicación del scheduler
 * o publicación manual desde el Redactor / bot), se envía un post al canal
 * público de Telegram de la filial con:
 *   - Foto de portada (si hay)
 *   - Título + breve extracto + fuente
 *   - Botón inline "Leer en riverplateisrael.com"
 *   - Si la nota es una previa de partido: tarjeta "⏰ Próximo partido"
 *
 * Config: env var TELEGRAM_CANAL_ID (chat_id numérico -100... o @username
 * público del canal). El bot debe ser administrador del canal.
 *
 * Fire-and-forget: nunca bloquea ni rompe el flujo de publicación.
 */

import { logger } from "./logger";
import { resolverCaptionTelegram } from "./openai-news";

export interface NotaParaPromocionar {
  id: number;
  titulo: string;
  contenido?: string | null;
  telegramCaption?: string | null;
  fuente?: string | null;
  imagenPortada?: string | null;
  categoria?: string | null;
  tags?: string | null;
}

/**
 * Envía la nota al canal público de Telegram. Fire-and-forget:
 * llamar sin await o con .catch(() => {}).
 */
/**
 * Normaliza el identificador del canal: acepta "@usuario", "-100...",
 * un link "https://t.me/usuario" o el usuario pelado "usuario".
 */
export function normalizarCanalId(valor: string): string {
  let v = valor.trim();
  const m = v.match(/t\.me\/([A-Za-z0-9_]+)/);
  if (m) return `@${m[1]}`;
  if (v.startsWith("@") || v.startsWith("-") || /^\d+$/.test(v)) return v;
  return `@${v}`;
}

export async function promocionarNotaEnCanal(nota: NotaParaPromocionar): Promise<void> {
  const canalCrudo = process.env.TELEGRAM_CANAL_ID;
  const canal = canalCrudo ? normalizarCanalId(canalCrudo) : canalCrudo;
  const token = process.env.TELEGRAM_TOKEN;
  if (!canal || !token) {
    logger.info(
      { canalConfigurado: Boolean(canal) },
      "promocionarNotaEnCanal: TELEGRAM_CANAL_ID no configurado, no se promociona la nota",
    );
    return;
  }

  const dominio = process.env.TELEGRAM_WEBHOOK_DOMAIN ?? "riverplateisrael.com";
  const urlNota = `https://${dominio}/noticia/${nota.id}`;
  // El paquete generado antes de guardar ya trae un teaser separado. Si la
  // nota es histórica o fue creada antes de este flujo, el fallback sigue
  // siendo un teaser de dos oraciones, nunca el artículo completo.
  const caption = resolverCaptionTelegram(nota.telegramCaption, {
    titulo: nota.titulo.slice(0, 250),
    contenido: nota.contenido,
    url: urlNota,
  });

  const replyMarkup = {
    inline_keyboard: [[{ text: "📖 Leer en riverplateisrael.com", url: urlNota }]],
  };

  // Con foto: sendPhoto (caption máx. 1024). Sin foto: sendMessage (máx. 4096).
  let fotoUrl: string | null = null;
  if (nota.imagenPortada) {
    if (/^https?:\/\//.test(nota.imagenPortada)) fotoUrl = nota.imagenPortada;
    else if (nota.imagenPortada.startsWith("/objects/")) fotoUrl = `https://${dominio}/api/storage${nota.imagenPortada}`;
    else fotoUrl = `https://${dominio}${nota.imagenPortada}`;
  }

  try {
    let res: Response;
    if (fotoUrl) {
      res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: canal,
          photo: fotoUrl,
           caption,
          parse_mode: "Markdown",
          reply_markup: replyMarkup,
        }),
        signal: AbortSignal.timeout(15000),
      });
      // Si Telegram no pudo bajar la foto, degradamos a mensaje de texto.
      if (!(await telegramAcepto(res))) {
        logger.warn({ id: nota.id, status: res.status }, "promocionarNotaEnCanal: sendPhoto falló, reintento como texto");
        res = await enviarTexto(token, canal, caption, replyMarkup);
      }
    } else {
      res = await enviarTexto(token, canal, caption, replyMarkup);
    }

    if (await telegramAcepto(res)) {
      logger.info({ id: nota.id, canal }, "promocionarNotaEnCanal: nota promocionada en el canal público");
    } else {
      const data = await res.clone().json().catch(() => null) as { description?: string } | null;
      logger.error(
        { id: nota.id, status: res.status, description: data?.description },
        "promocionarNotaEnCanal: Telegram rechazó el envío",
      );
    }
  } catch (err) {
    logger.error({ err, id: nota.id }, "promocionarNotaEnCanal: error enviando al canal");
  }
}

async function telegramAcepto(res: Response): Promise<boolean> {
  if (!res.ok) return false;
  const data = await res.clone().json().catch(() => null) as { ok?: boolean } | null;
  return data?.ok !== false;
}

async function enviarTexto(
  token: string,
  canal: string,
  caption: string,
  replyMarkup: unknown,
): Promise<Response> {
  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: canal,
      text: caption,
      parse_mode: "Markdown",
      reply_markup: replyMarkup,
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(15000),
  });
}
