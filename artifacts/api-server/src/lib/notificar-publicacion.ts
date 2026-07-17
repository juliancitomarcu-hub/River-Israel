/**
 * Aviso de Telegram cuando una nota queda publicada en el sitio.
 *
 * Centralizado para que TODOS los caminos de publicación avisen:
 * - Redactor IA → "Publicar" (POST /publicar-noticia)
 * - Edición de nota pendiente que la publica (PUT /noticia-pendiente/:id)
 * - Botón "Publicar" del bot de Telegram (ya edita el mensaje, no usa esto)
 * - Autopublicación del scheduler (envía su propio FYI, no usa esto)
 *
 * Fire-and-forget: nunca bloquea ni rompe la respuesta HTTP.
 */

import { logger } from "./logger";
import { credencialesTelegram, type CategoriaTelegram } from "./telegram-cred";

/** Escapa caracteres especiales de Markdown (v1) de Telegram. */
function escaparMarkdown(s: string): string {
  return s.replace(/([_*`\[])/g, "\\$1");
}

export interface NotaPublicada {
  id: number;
  titulo: string;
  categoria: string;
  fuente?: string | null;
  imagenPortada?: string | null;
}

export function notificarNotaPublicada(nota: NotaPublicada): void {
  const categoria: CategoriaTelegram = nota.categoria === "seleccion" ? "seleccion" : "river";
  const cred = credencialesTelegram(categoria);
  if (!cred) {
    logger.warn({ categoria }, "notificarNotaPublicada: bot de Telegram no configurado, no se envía aviso");
    return;
  }

  const dominio = process.env.TELEGRAM_WEBHOOK_DOMAIN ?? "riverplateisrael.com";
  const url = `https://${dominio}/noticia/${nota.id}`;

  const etiquetaCat = categoria === "seleccion" ? "🇦🇷 _Selección Argentina_\n" : "⚪️🔴 _River_\n";
  const fuenteTexto = nota.fuente ? `📡 _Fuente: ${escaparMarkdown(nota.fuente.slice(0, 100))}_\n` : "";
  const fotoTexto = nota.imagenPortada ? "🖼 _Con foto de portada_\n" : "";
  const texto =
    `📢 *Nota publicada en el sitio*\n\n` +
    `📰 *${escaparMarkdown(nota.titulo.slice(0, 300))}*\n\n` +
    etiquetaCat + fuenteTexto + fotoTexto;

  void fetch(`https://api.telegram.org/bot${cred.token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: cred.chatId,
      text: texto,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "🌐 Ver la nota", url }]],
      },
    }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        logger.warn({ status: res.status, body, notaId: nota.id }, "notificarNotaPublicada: Telegram respondió con error");
      }
    })
    .catch((err) => {
      logger.warn({ err, notaId: nota.id }, "notificarNotaPublicada: fallo enviando aviso a Telegram");
    });
}
