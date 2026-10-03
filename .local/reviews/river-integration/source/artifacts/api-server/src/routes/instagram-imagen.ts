/**
 * GET /instagram-imagen/:id
 *
 * Sirve la foto de portada de una noticia procesada para Instagram:
 * - Recorte automático a 4:5 vertical (1080×1350), la proporción ideal de un post.
 * - JPEG comprimido (calidad 80) — muy por debajo del límite de 8 MB de la API de IG.
 *
 * Make.com recibe esta URL en el campo `imagen` y se la pasa al módulo de Instagram.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db, noticiasTable } from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { urlImagenSegura } from "../lib/url-imagen-segura";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const ANCHO = 1080;
const ALTO = 1350; // 4:5 vertical

// Cache en memoria: clave = url de portada, valor = JPEG procesado
const cache = new Map<string, Buffer>();
const CACHE_MAX = 50;

const MAX_BYTES = 15 * 1024 * 1024; // sanidad: tope de descarga

async function obtenerBytesOrigen(imagenPortada: string): Promise<Buffer | null> {
  if (imagenPortada.startsWith("/objects/")) {
    const file = await objectStorageService.getObjectEntityFile(imagenPortada);
    const response = await objectStorageService.downloadObject(file);
    if (!response.ok || !response.body) return null;
    const buf = Buffer.from(await response.arrayBuffer());
    return buf.length > MAX_BYTES ? null : buf;
  }

  let url = imagenPortada;
  const esLocal = imagenPortada.startsWith("/");
  if (esLocal) {
    // Rutas locales del frontend, p. ej. /images/galeria/foto-01.jpeg
    const dominio = process.env.TELEGRAM_WEBHOOK_DOMAIN ?? "riverplateisrael.com";
    url = process.env.NODE_ENV === "production" ? `https://${dominio}${imagenPortada}` : `http://localhost:80${imagenPortada}`;
  } else if (!urlImagenSegura(imagenPortada)) {
    // Anti-SSRF: solo URLs http(s) públicas
    return null;
  }

  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) });
  if (!res.ok) return null;
  // Anti-SSRF: si hubo redirects, validar también el destino final
  if (!esLocal && res.url && !urlImagenSegura(res.url)) return null;
  const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!contentType.startsWith("image/")) return null;
  const contentLength = Number(res.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BYTES) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length > MAX_BYTES ? null : buf;
}

router.get("/instagram-imagen/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const [nota] = await db.select().from(noticiasTable).where(eq(noticiasTable.id, id)).limit(1);
    const portada = nota?.imagenPortada?.trim();
    // Solo notas publicadas: no exponer portadas de borradores por ID
    if (!nota || !nota.publicada || !portada) {
      res.status(404).json({ error: "Noticia sin foto de portada" });
      return;
    }

    let jpeg = cache.get(portada);
    if (!jpeg) {
      const origen = await obtenerBytesOrigen(portada);
      if (!origen) {
        res.status(404).json({ error: "No se pudo obtener la imagen de origen" });
        return;
      }

      jpeg = await sharp(origen, { limitInputPixels: 50_000_000 })
        .rotate() // respeta orientación EXIF
        .resize(ANCHO, ALTO, { fit: "cover", position: "attention" })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();

      if (cache.size >= CACHE_MAX) {
        const primera = cache.keys().next().value;
        if (primera) cache.delete(primera);
      }
      cache.set(portada, jpeg);
    }

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(jpeg);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Imagen no encontrada" });
      return;
    }
    req.log.error({ err: error }, "Error generando imagen para Instagram");
    res.status(500).json({ error: "Error procesando la imagen" });
  }
});

export default router;
