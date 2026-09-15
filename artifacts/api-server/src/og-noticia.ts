/**
 * Open Graph dinámico por nota: /noticia/:id
 *
 * El frontend es un SPA estático, así que los crawlers de WhatsApp/Facebook/X
 * nunca ven los meta tags que setea React. Este handler sirve el MISMO shell
 * del SPA (lo baja del host estático y lo cachea) pero con og:title,
 * og:description, og:image y <title> reemplazados por los de la nota.
 *
 * El proxy enruta /noticia/* a este servidor (path en artifact.toml).
 * Para usuarios reales la página funciona igual: el shell carga el SPA y
 * el router muestra la nota.
 */

import type { Request, Response } from "express";
import sharp from "sharp";
import { db, noticiasTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./lib/logger";
import { ObjectNotFoundError, ObjectStorageService } from "./lib/objectStorage";
import { urlImagenSeguraAsync } from "./lib/url-imagen-segura";

type FetchResponse = globalThis.Response;

const SITE_URL = (process.env.SITE_URL ?? "https://riverplateisrael.com").replace(/\/$/, "");
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const ALLOWED_SOURCE_TYPES = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);

let shellCache: { html: string; at: number } | null = null;
const SHELL_TTL = 10 * 60 * 1000;
const imageCache = new Map<string, Buffer>();
const IMAGE_CACHE_MAX = 50;
const objectStorageService = new ObjectStorageService();

export interface NoticiaOgData {
  id: number;
  titulo: string;
  contenido: string | null;
  imagenPortada?: string | null;
  publicada?: boolean;
}

async function obtenerShell(): Promise<string | null> {
  if (shellCache && Date.now() - shellCache.at < SHELL_TTL) return shellCache.html;
  try {
    // Development must use the local SPA shell, not production asset hashes.
    const shellOrigin = process.env.NODE_ENV === "production" ? SITE_URL : "http://localhost:80";
    const res = await fetch(`${shellOrigin}/`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`shell ${res.status}`);
    const html = await res.text();
    if (!html.includes("<div id=\"root\"") && !html.includes("<div id='root'")) {
      throw new Error("el HTML recibido no parece el shell del SPA");
    }
    shellCache = { html, at: Date.now() };
    return html;
  } catch (err) {
    logger.warn({ err }, "og-noticia: no se pudo obtener el shell del SPA");
    return shellCache?.html ?? null;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Convierte la ruta de portada guardada en DB en una URL pública absoluta. */
export function absolutizarImagen(ruta: string): string {
  if (/^https?:\/\//.test(ruta)) return ruta;
  // Las portadas en object storage se sirven a través de /api/storage
  if (ruta.startsWith("/objects/")) return `${SITE_URL}/api/storage${ruta}`;
  return `${SITE_URL}${ruta}`;
}

function extraerDescripcion(contenido: string | null): string {
  if (!contenido) return "Las últimas noticias de River Plate para los hinchas en Israel.";
  const plano = contenido.replace(/[#*_`>]/g, "").replace(/\[(.*?)\]\(.*?\)/g, "$1").trim();
  const parrafo = plano.split(/\n{2,}|\n/).find((p) => p.trim().length > 60) ?? plano;
  const texto = parrafo.trim().replace(/\s+/g, " ");
  return texto.length > 200 ? `${texto.slice(0, 200).replace(/\s+\S*$/, "")}…` : texto;
}

function reemplazarMeta(html: string, prop: string, contenido: string, attr = "property"): string {
  const attrEscapado = attr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const propEscapada = prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<meta\\b(?=[^>]*\\b${attrEscapado}=["']${propEscapada}["'])(?=[^>]*\\bcontent=["'][^"']*["'])[^>]*\\/?>`,
    "i",
  );
  const tag = `<meta ${attr}="${prop}" content="${contenido}" />`;
  if (regex.test(html)) return html.replace(regex, () => tag);
  return html.replace(/<\/head>/i, () => `  ${tag}\n</head>`);
}

function reemplazarCanonical(html: string, url: string): string {
  const regex = /<link\b(?=[^>]*\brel=["']canonical["'])(?=[^>]*\bhref=["'][^"']*["'])[^>]*\/?>/i;
  const tag = `<link rel="canonical" href="${url}" />`;
  if (regex.test(html)) return html.replace(regex, () => tag);
  return html.replace(/<\/head>/i, () => `  ${tag}\n</head>`);
}

function urlImagenSocial(id: number): string {
  return `${SITE_URL}/api/og-image/noticia/${id}`;
}

/**
 * Reemplaza los metadatos del shell sin depender de cómo estén ordenados los
 * atributos del HTML estático. Esta función es pura para que los tags
 * server-rendered se puedan verificar sin levantar Express.
 */
export function construirHtmlNoticia(shell: string, nota: NoticiaOgData): string {
  const titulo = escapeHtml(nota.titulo);
  const descripcion = escapeHtml(extraerDescripcion(nota.contenido));
  const imagen = escapeHtml(urlImagenSocial(nota.id));
  const urlNota = escapeHtml(`${SITE_URL}/noticia/${nota.id}`);

  let html = shell;
  html = html.replace(/<title>[^<]*<\/title>/i, () => `<title>${titulo} · River en Israel</title>`);
  html = reemplazarMeta(html, "og:title", titulo);
  html = reemplazarMeta(html, "og:description", descripcion);
  html = reemplazarMeta(html, "og:image", imagen);
  html = reemplazarMeta(html, "og:image:width", String(OG_IMAGE_WIDTH));
  html = reemplazarMeta(html, "og:image:height", String(OG_IMAGE_HEIGHT));
  html = reemplazarMeta(html, "og:image:type", "image/jpeg");
  html = reemplazarMeta(html, "og:url", urlNota);
  html = reemplazarMeta(html, "og:type", "article");
  html = reemplazarMeta(html, "twitter:title", titulo, "name");
  html = reemplazarMeta(html, "twitter:description", descripcion, "name");
  html = reemplazarMeta(html, "twitter:image", imagen, "name");
  html = reemplazarMeta(html, "twitter:card", "summary_large_image", "name");
  html = reemplazarMeta(html, "description", descripcion, "name");
  html = reemplazarCanonical(html, urlNota);
  return html;
}

async function obtenerNotaPublicada(id: number): Promise<NoticiaOgData | undefined> {
  const [nota] = await db
    .select({
      id: noticiasTable.id,
      titulo: noticiasTable.titulo,
      contenido: noticiasTable.contenido,
      imagenPortada: noticiasTable.imagenPortada,
      publicada: noticiasTable.publicada,
    })
    .from(noticiasTable)
    .where(and(eq(noticiasTable.id, id), eq(noticiasTable.publicada, true)))
    .limit(1);
  return nota;
}

export async function ogNoticiaHandler(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.redirect(302, `${SITE_URL}/`);
    return;
  }

  try {
    const nota = await obtenerNotaPublicada(id);

    const shell = await obtenerShell();
    if (!shell) {
      // Sin shell no podemos servir el SPA: mandamos al home.
      res.redirect(302, `${SITE_URL}/`);
      return;
    }

    if (!nota) {
      res.status(200).type("html").send(shell);
      return;
    }

    const html = construirHtmlNoticia(shell, nota);
    res.status(200).type("html").setHeader("Cache-Control", "public, max-age=300").send(html);
  } catch (err) {
    logger.error({ err, id }, "og-noticia: error generando la página");
    res.redirect(302, `${SITE_URL}/`);
  }
}

function rutaObjetoSegura(ruta: string): boolean {
  if (!ruta.startsWith("/objects/")) return false;
  const segmentos = ruta.slice("/objects/".length).split("/");
  return segmentos.length > 0 && segmentos.every((segmento) => segmento.length > 0 && segmento !== "." && segmento !== "..");
}

function rutaLocalSegura(ruta: string): boolean {
  // A path beginning with // would be interpreted as a different host by URL.
  return ruta.startsWith("/") && !ruta.startsWith("//") && !ruta.includes("\\") && !ruta.includes("\0");
}

async function leerBufferLimitado(response: FetchResponse): Promise<Buffer | null> {
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_SOURCE_BYTES) return null;

  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_SOURCE_BYTES) return null;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}

async function obtenerImagenHttp(urlInicial: string): Promise<Buffer | null> {
  let urlActual = urlInicial;
  for (let intento = 0; intento <= MAX_REDIRECTS; intento++) {
    if (!(await urlImagenSeguraAsync(urlActual))) return null;

    const response = await fetch(urlActual, {
      redirect: "manual",
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8" },
      signal: AbortSignal.timeout(15_000),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || intento === MAX_REDIRECTS) return null;
      urlActual = new URL(location, urlActual).toString();
      continue;
    }

    if (!response.ok) return null;
    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_SOURCE_TYPES.has(contentType)) return null;
    return leerBufferLimitado(response);
  }
  return null;
}

async function obtenerBytesOrigen(imagenPortada: string): Promise<Buffer | null> {
  if (rutaObjetoSegura(imagenPortada)) {
    const file = await objectStorageService.getObjectEntityFile(imagenPortada);
    const [metadata] = await file.getMetadata();
    if (!ALLOWED_SOURCE_TYPES.has(String(metadata.contentType ?? "").toLowerCase())) return null;
    if (Number(metadata.size ?? 0) > MAX_SOURCE_BYTES) return null;
    const [buffer] = await file.download();
    return buffer.length <= MAX_SOURCE_BYTES ? buffer : null;
  }

  if (imagenPortada.startsWith("/public-objects/")) {
    const publicPath = imagenPortada.slice("/public-objects/".length);
    if (!publicPath || publicPath.includes("..") || publicPath.includes("\\")) return null;
    const file = await objectStorageService.searchPublicObject(publicPath);
    if (!file) return null;
    const [metadata] = await file.getMetadata();
    if (!ALLOWED_SOURCE_TYPES.has(String(metadata.contentType ?? "").toLowerCase())) return null;
    if (Number(metadata.size ?? 0) > MAX_SOURCE_BYTES) return null;
    const [buffer] = await file.download();
    return buffer.length <= MAX_SOURCE_BYTES ? buffer : null;
  }

  if (rutaLocalSegura(imagenPortada)) {
    const urlLocal = new URL(imagenPortada, `${SITE_URL}/`);
    if (urlLocal.origin !== new URL(`${SITE_URL}/`).origin) return null;
    return obtenerImagenHttp(urlLocal.toString());
  }

  if (/^https?:\/\//i.test(imagenPortada)) {
    return obtenerImagenHttp(imagenPortada);
  }
  return null;
}

function escaparSvg(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function cortarLineas(texto: string, maxChars = 32): string[] {
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let linea = "";
  for (const palabra of palabras) {
    const candidata = linea ? `${linea} ${palabra}` : palabra;
    if (linea && candidata.length > maxChars) {
      lineas.push(linea);
      linea = palabra;
    } else {
      linea = candidata;
    }
    if (lineas.length === 3) break;
  }
  if (linea && lineas.length < 3) lineas.push(linea);
  return lineas;
}

export async function generarImagenFallback(titulo: string): Promise<Buffer> {
  const lineas = cortarLineas(titulo.replace(/\*/g, ""));
  const texto = lineas
    .map((linea, index) => `<text x="80" y="${280 + index * 78}" fill="#ffffff" font-family="Arial, sans-serif" font-size="58" font-weight="700">${escaparSvg(linea)}</text>`)
    .join("");
  const svg = `<svg width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#090909"/><stop offset="0.62" stop-color="#3a0000"/><stop offset="1" stop-color="#cc0000"/></linearGradient></defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <path d="M0 500 L1200 250 L1200 630 L0 630 Z" fill="#cc0000" opacity=".55"/>
    <text x="80" y="120" fill="#ffffff" font-family="Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="5">RIVER EN ISRAEL</text>
    ${texto}
    <text x="80" y="555" fill="#ffffff" opacity=".8" font-family="Arial, sans-serif" font-size="22">Noticias, comunidad y pasión millonaria</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

/** Procesa cualquier portada o crea una imagen editorial cuando no hay origen. */
export async function procesarImagenSocial(origen: Buffer | null, titulo: string): Promise<Buffer> {
  try {
    return origen
      ? await sharp(origen, { limitInputPixels: 50_000_000 })
          .rotate()
          .resize(OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT, { fit: "cover", position: "attention" })
          .jpeg({ quality: 86, mozjpeg: true })
          .toBuffer()
      : await generarImagenFallback(titulo);
  } catch (err) {
    logger.warn({ err }, "og-image: portada inválida; usando imagen generada");
    return generarImagenFallback(titulo);
  }
}

async function generarImagenSocial(nota: NoticiaOgData): Promise<Buffer> {
  const cacheKey = `${nota.id}:${nota.titulo}:${nota.imagenPortada ?? ""}`;
  const cached = imageCache.get(cacheKey);
  if (cached) return cached;

  let origen: Buffer | null = null;
  if (nota.imagenPortada?.trim()) {
    try {
      origen = await obtenerBytesOrigen(nota.imagenPortada.trim());
    } catch (err) {
      if (!(err instanceof ObjectNotFoundError)) {
        logger.warn({ err, id: nota.id }, "og-image: no se pudo obtener la portada");
      }
    }
  }

  const jpeg = await procesarImagenSocial(origen, nota.titulo);

  if (imageCache.size >= IMAGE_CACHE_MAX) {
    const primera = imageCache.keys().next().value;
    if (primera) imageCache.delete(primera);
  }
  imageCache.set(cacheKey, jpeg);
  return jpeg;
}

export async function ogImageNoticiaHandler(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).type("text/plain").send("ID inválido");
    return;
  }

  try {
    const nota = await obtenerNotaPublicada(id);
    if (!nota) {
      res.status(404).type("text/plain").send("Noticia no encontrada");
      return;
    }
    const jpeg = await generarImagenSocial(nota);
    res
      .status(200)
      .setHeader("Content-Type", "image/jpeg")
      .setHeader("Content-Length", String(jpeg.length))
      .setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800")
      .send(jpeg);
  } catch (err) {
    logger.error({ err, id }, "og-image: error generando la imagen social");
    res.status(500).type("text/plain").send("Error generando la imagen social");
  }
}
