/**
 * Envío de notas publicadas al webhook de Make.com para automatizar
 * la publicación en Instagram (y otras redes).
 *
 * Fire-and-forget: nunca bloquea ni rompe el flujo de publicación.
 * Si MAKE_WEBHOOK_URL no está configurada, no hace nada.
 */

import { logger } from "./logger";

export interface NotaParaMake {
  id: number;
  titulo: string;
  contenido: string;
  tags?: string | null;
  categoria: string;
  fuente?: string | null;
  imagenPortada?: string | null;
}

/** Resuelve la imagen de portada a una URL pública absoluta. */
function imagenAbsoluta(imagenPortada: string | null | undefined, dominio: string): string {
  if (!imagenPortada) return "";
  if (imagenPortada.startsWith("http")) return imagenPortada;
  if (imagenPortada.startsWith("/objects/")) return `https://${dominio}/api/storage${imagenPortada}`;
  if (imagenPortada.startsWith("/images/")) return `https://${dominio}${imagenPortada}`;
  return `https://${dominio}/api/storage${imagenPortada}`;
}

export function enviarNotaAMake(nota: NotaParaMake): void {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.warn({ notaId: nota.id }, "enviarNotaAMake: MAKE_WEBHOOK_URL no configurada, se omite");
    return;
  }

  const dominio = process.env.TELEGRAM_WEBHOOK_DOMAIN ?? "riverplateisrael.com";
  const urlNota = `https://${dominio}/noticia/${nota.id}`;
  const imagen = imagenAbsoluta(nota.imagenPortada, dominio);

  // Caption listo para Instagram: título + primer párrafo + tags + link.
  // Límite de IG: 2200 caracteres — dejamos margen.
  const primerParrafo =
    nota.contenido
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 20) ?? "";
  const tags = (nota.tags ?? "").trim();
  let caption = `${nota.titulo}\n\n${primerParrafo}`;
  if (caption.length > 1800) caption = caption.slice(0, 1797) + "...";
  caption += `\n\nNota completa: ${urlNota}`;
  if (tags) caption += `\n\n${tags}`;

  void fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: nota.id,
      titulo: nota.titulo,
      contenido: nota.contenido,
      caption,
      tags,
      categoria: nota.categoria === "seleccion" ? "seleccion" : "river",
      fuente: nota.fuente ?? "",
      urlNota,
      imagen,
    }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        logger.warn({ status: res.status, body: body.slice(0, 300), notaId: nota.id }, "enviarNotaAMake: Make respondió con error");
      } else {
        logger.info({ notaId: nota.id }, "enviarNotaAMake: nota enviada a Make/Instagram");
      }
    })
    .catch((err) => {
      logger.warn({ err, notaId: nota.id }, "enviarNotaAMake: fallo enviando a Make");
    });
}
