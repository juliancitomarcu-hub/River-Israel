/** Publicación en redes: placa persistente antes de avisar a Make. */
import { logger } from "./logger";
import { generarPlacaRedes } from "./generar-placa-redes";

export interface NotaParaMake {
  id: number;
  titulo: string;
  contenido: string;
  tags?: string | null;
  categoria: string;
  fuente?: string | null;
  imagenPortada?: string | null;
}

export interface PayloadRedes {
  titulo: string;
  url_nota: string;
  url_imagen: string;
  caption: string;
}

export function crearCaptionRedes(nota: NotaParaMake): string {
  const titulo = nota.titulo.replace(/<[^>]*>/g, "").replace(/[*_`]/g, "").trim();
  const hashtags = Array.from(new Set([
    "#RiverPlate", "#ElMasGrande",
    ...((nota.tags ?? "").match(/#[\p{L}\p{N}_]+/gu) ?? []),
  ])).slice(0, 6);
  return `${titulo.slice(0, 240)}\n\nConocé los detalles en la nota completa.\n\n${hashtags.join(" ")}`;
}

/** Awaitable for controlled tests; throws on failure instead of claiming delivery. */
export async function enviarNotaAMakeConfirmado(
  nota: NotaParaMake,
  baseUrl = `https://${process.env.TELEGRAM_WEBHOOK_DOMAIN ?? "riverplateisrael.com"}`,
): Promise<{ status: number; payload: PayloadRedes; filePath: string }> {
  const webhook = process.env.WEBHOOK_REDES_URL?.trim();
  if (!webhook) throw new Error("WEBHOOK_REDES_URL no configurada");
  // Do not include the webhook URL (a secret) in errors, redirects or logs.
  let endpoint: URL;
  try { endpoint = new URL(webhook); } catch { throw new Error("WEBHOOK_REDES_URL inválida"); }
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) {
    throw new Error("WEBHOOK_REDES_URL debe ser una URL HTTPS");
  }
  const base = new URL(baseUrl).origin;
  const placa = await generarPlacaRedes(nota, base);
  // Check anonymous access before asking an external service to consume it.
  const imageCheck = await fetch(placa.url, { method: "HEAD", signal: AbortSignal.timeout(15000) });
  if (!imageCheck.ok || !imageCheck.headers.get("content-type")?.startsWith("image/")) {
    throw new Error(`La placa no está accesible públicamente (HTTP ${imageCheck.status})`);
  }
  const payload: PayloadRedes = {
    titulo: nota.titulo,
    url_nota: `${base}/noticia/${nota.id}`,
    url_imagen: placa.url,
    caption: crearCaptionRedes(nota),
  };
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.MAKE_API_KEY) headers["x-make-apikey"] = process.env.MAKE_API_KEY;
  let response: Response;
  try {
    response = await fetch(webhook, {
      method: "POST", headers, body: JSON.stringify(payload),
      redirect: "error", signal: AbortSignal.timeout(20000),
    });
  } catch {
    // A timed-out POST may have arrived. Never blindly retry and duplicate posts.
    throw new Error("No se pudo confirmar la recepción de Make; revisar el escenario antes de reenviar");
  }
  if (!response.ok) throw new Error(`Make rechazó la noticia (HTTP ${response.status})`);
  logger.info({ notaId: nota.id, status: response.status }, "Make: webhook aceptó la placa y la noticia");
  return { status: response.status, payload, filePath: placa.filePath };
}

/** Keep publication independent of Make, while recording failures explicitly. */
export function enviarNotaAMake(nota: NotaParaMake): void {
  if (!process.env.WEBHOOK_REDES_URL?.trim()) {
    logger.warn({ notaId: nota.id }, "Make: WEBHOOK_REDES_URL no configurada, envío omitido");
    return;
  }
  void enviarNotaAMakeConfirmado(nota).catch(() => {
    // Do not serialize errors that might contain signed storage URLs or secrets.
    logger.error({ notaId: nota.id }, "Make: no se confirmó el envío de la placa; revisar antes de reenviar");
  });
}