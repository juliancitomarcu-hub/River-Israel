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
import { enviarNotaAMake } from "./enviar-a-make";
import { promocionarNotaEnCanal } from "./promocionar-nota";
import { resolverCaptionTelegram } from "./openai-news";

export interface NotaPublicada {
  id: number;
  titulo: string;
  categoria: string;
  fuente?: string | null;
  imagenPortada?: string | null;
  contenido?: string | null;
  telegramCaption?: string | null;
  tags?: string | null;
}

export function notificarNotaPublicada(nota: NotaPublicada): void {
  // 📣 Promoción automática en el canal público de Telegram (fire-and-forget)
  promocionarNotaEnCanal(nota).catch(() => {});

  // 📸 Instagram vía Make.com (fire-and-forget, no bloquea)
  enviarNotaAMake({
    id: nota.id,
    titulo: nota.titulo,
    contenido: nota.contenido ?? "",
    tags: nota.tags,
    categoria: nota.categoria,
    fuente: nota.fuente,
    imagenPortada: nota.imagenPortada,
  });

  const categoria: CategoriaTelegram = nota.categoria === "seleccion" ? "seleccion" : "river";
  const cred = credencialesTelegram(categoria);
  if (!cred) {
    logger.warn({ categoria }, "notificarNotaPublicada: bot de Telegram no configurado, no se envía aviso");
    return;
  }

  const dominio = process.env.TELEGRAM_WEBHOOK_DOMAIN ?? "riverplateisrael.com";
  const url = `https://${dominio}/noticia/${nota.id}`;

  const texto = resolverCaptionTelegram(nota.telegramCaption, {
    titulo: nota.titulo.slice(0, 300),
    contenido: nota.contenido,
    url,
  });

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
      const body = await res.json().catch(() => null) as { ok?: boolean; description?: string } | null;
      if (!res.ok || body?.ok === false) {
        logger.warn(
          { status: res.status, description: body?.description, notaId: nota.id },
          "notificarNotaPublicada: Telegram respondió con error",
        );
      }
    })
    .catch((err) => {
      logger.warn({ err, notaId: nota.id }, "notificarNotaPublicada: fallo enviando aviso a Telegram");
    });
}
