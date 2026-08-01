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
import { db, noticiasTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./lib/logger";

const SITE_URL = (process.env.SITE_URL ?? "https://riverplateisrael.com").replace(/\/$/, "");

let shellCache: { html: string; at: number } | null = null;
const SHELL_TTL = 10 * 60 * 1000;

async function obtenerShell(): Promise<string | null> {
  if (shellCache && Date.now() - shellCache.at < SHELL_TTL) return shellCache.html;
  try {
    const res = await fetch(`${SITE_URL}/`, { signal: AbortSignal.timeout(8000) });
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
  const regex = new RegExp(`<meta\\s+${attr}="${prop}"\\s+content="[^"]*"\\s*/?>`, "i");
  const tag = `<meta ${attr}="${prop}" content="${contenido}" />`;
  if (regex.test(html)) return html.replace(regex, tag);
  return html.replace(/<\/head>/i, `  ${tag}\n</head>`);
}

export async function ogNoticiaHandler(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.redirect(302, `${SITE_URL}/`);
    return;
  }

  try {
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

    const titulo = escapeHtml(nota.titulo);
    const descripcion = escapeHtml(extraerDescripcion(nota.contenido));
    const imagen = nota.imagenPortada
      ? escapeHtml(absolutizarImagen(nota.imagenPortada))
      : `${SITE_URL}/opengraph.jpg`;
    const urlNota = `${SITE_URL}/noticia/${nota.id}`;

    let html = shell;
    html = html.replace(/<title>[^<]*<\/title>/i, `<title>${titulo} · River en Israel</title>`);
    html = reemplazarMeta(html, "og:title", titulo);
    html = reemplazarMeta(html, "og:description", descripcion);
    html = reemplazarMeta(html, "og:image", imagen);
    html = reemplazarMeta(html, "og:url", urlNota);
    html = reemplazarMeta(html, "og:type", "article");
    html = reemplazarMeta(html, "twitter:title", titulo, "name");
    html = reemplazarMeta(html, "twitter:description", descripcion, "name");
    html = reemplazarMeta(html, "twitter:image", imagen, "name");
    html = reemplazarMeta(html, "twitter:card", "summary_large_image", "name");
    html = reemplazarMeta(html, "description", descripcion, "name");

    res.status(200).type("html").setHeader("Cache-Control", "public, max-age=300").send(html);
  } catch (err) {
    logger.error({ err, id }, "og-noticia: error generando la página");
    res.redirect(302, `${SITE_URL}/`);
  }
}
