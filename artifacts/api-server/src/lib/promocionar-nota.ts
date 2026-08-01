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

/** Escapa caracteres especiales de Markdown (v1) de Telegram. */
function escaparMarkdown(s: string): string {
  return s.replace(/([_*`\[])/g, "\\$1");
}

export interface NotaParaPromocionar {
  id: number;
  titulo: string;
  contenido?: string | null;
  fuente?: string | null;
  imagenPortada?: string | null;
  categoria?: string | null;
  tags?: string | null;
}

/** Primer párrafo legible de la nota, sin markdown, recortado. */
function extraerExtracto(contenido: string | null | undefined, max = 220): string {
  if (!contenido) return "";
  const plano = contenido
    .replace(/[#*_`>]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .trim();
  const parrafo = plano.split(/\n{2,}|\n/).find((p) => p.trim().length > 60) ?? plano;
  const texto = parrafo.trim().replace(/\s+/g, " ");
  if (texto.length <= max) return texto;
  return `${texto.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

/** Heurística: ¿la nota habla del próximo partido / es una previa? */
function esPrevia(nota: NotaParaPromocionar): boolean {
  const texto = `${nota.titulo} ${nota.tags ?? ""} ${(nota.contenido ?? "").slice(0, 800)}`.toLowerCase();
  return /previa|próximo partido|proximo partido|se enfrenta|enfrenta a|recibe a|visita a|\bvs\.?\b|fixture|se juega|antesala/.test(
    texto,
  );
}

interface ProximoPartido {
  fecha?: string;
  horaIsrael?: string;
  equipoLocal?: string;
  equipoVisitante?: string;
  estado?: string;
}

/** Consulta el próximo partido a la propia API (usa el caché interno). */
async function obtenerProximoPartido(): Promise<ProximoPartido | null> {
  try {
    const puerto = process.env.PORT ?? "8080";
    const res = await fetch(`http://127.0.0.1:${puerto}/api/partido-proximo`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ProximoPartido;
    if (!data?.equipoLocal || !data?.equipoVisitante) return null;
    if (data.estado === "FINALIZADO") return null;
    return data;
  } catch {
    return null;
  }
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

  const titulo = escaparMarkdown(nota.titulo.slice(0, 250));
  const extracto = escaparMarkdown(extraerExtracto(nota.contenido));
  // Sin firma de fuente: la nota se presenta como redacción propia del diario.
  const fuenteTexto = "";

  // ⏰ Tarjeta de próximo partido solo si la nota es una previa / habla del fixture
  let tarjetaPartido = "";
  if (esPrevia(nota)) {
    const partido = await obtenerProximoPartido();
    if (partido) {
      const cruce = escaparMarkdown(`${partido.equipoLocal} vs ${partido.equipoVisitante}`);
      const cuando = [partido.fecha, partido.horaIsrael ? `${partido.horaIsrael} HS` : null]
        .filter(Boolean)
        .map((s) => escaparMarkdown(String(s)))
        .join(" — ");
      tarjetaPartido = `\n\n⏰ *Próximo partido: ${cruce}*${cuando ? `\n🗓 ${cuando} (hora Israel)` : ""}\n_Consultá el fixture en vivo en la web._`;
    }
  }

  const caption =
    `📰 *${titulo}*\n\n` + (extracto ? `${extracto}\n` : "") + fuenteTexto + tarjetaPartido;

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
          caption: caption.slice(0, 1020),
          parse_mode: "Markdown",
          reply_markup: replyMarkup,
        }),
        signal: AbortSignal.timeout(15000),
      });
      // Si Telegram no pudo bajar la foto, degradamos a mensaje de texto.
      if (!res.ok) {
        logger.warn({ id: nota.id, status: res.status }, "promocionarNotaEnCanal: sendPhoto falló, reintento como texto");
        res = await enviarTexto(token, canal, caption, replyMarkup);
      }
    } else {
      res = await enviarTexto(token, canal, caption, replyMarkup);
    }

    if (res.ok) {
      logger.info({ id: nota.id, canal }, "promocionarNotaEnCanal: nota promocionada en el canal público");
    } else {
      const cuerpo = await res.text().catch(() => "");
      logger.error({ id: nota.id, status: res.status, cuerpo: cuerpo.slice(0, 300) }, "promocionarNotaEnCanal: Telegram rechazó el envío");
    }
  } catch (err) {
    logger.error({ err, id: nota.id }, "promocionarNotaEnCanal: error enviando al canal");
  }
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
      text: caption.slice(0, 4000),
      parse_mode: "Markdown",
      reply_markup: replyMarkup,
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(15000),
  });
}
