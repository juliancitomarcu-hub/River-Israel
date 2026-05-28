import { generateImage } from "@workspace/integrations-gemini-ai";
import { ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";

export type CategoriaImagen = "river" | "seleccion";

function promptParaCategoria(titulo: string, categoria: CategoriaImagen): string {
  const base =
    "Diseñá una imagen cuadrada 1:1 (1080x1080) lista para feed de Instagram. " +
    "Estilo: portada editorial deportiva moderna, alto contraste, tipografía bold integrada, " +
    "composición dinámica, sin texto en inglés, sin marcas comerciales, sin logos de TV, sin marcas FIFA. " +
    `Título de la nota: "${titulo}".`;

  if (categoria === "seleccion") {
    return (
      base +
      " Tema: Selección Argentina rumbo al Mundial 2026 (visto desde Israel, fan side). " +
      "Paleta: celeste argentino #74ACDF, blanco, dorado #F1B82D, acento azul noche profundo. " +
      "Elementos sugeridos: jugadores en silueta con la camiseta albiceleste, sol de mayo dorado sutil, " +
      "trama de franjas celestes y blancas como fondo, atmósfera épica de hinchada. " +
      "NO incluyas el logo de la AFA ni de FIFA ni de adidas. NO escribas el nombre 'Mundial' ni 'FIFA'."
    );
  }

  return (
    base +
    " Tema: Club Atlético River Plate, hinchada desde Israel. " +
    "Paleta: rojo River #C8102E, blanco puro, negro profundo, acento dorado tenue. " +
    "Elementos sugeridos: la banda roja diagonal, atmósfera Monumental, hinchada, estética millonaria, " +
    "tipografía editorial deportiva. NO incluyas logos comerciales ni marcas de TV."
  );
}

/**
 * Genera una imagen 1:1 lista para Instagram con Gemini, la sube a object
 * storage y devuelve `{ url, buffer, mimeType }` para que el caller la
 * pueda mandar por Telegram en el mismo request sin re-descargar.
 *
 * Devuelve `null` si la generación falla (no rompe el flujo del redactor).
 */
export async function generarImagenIG(
  titulo: string,
  categoria: CategoriaImagen,
): Promise<{ url: string; buffer: Buffer; mimeType: string } | null> {
  try {
    const prompt = promptParaCategoria(titulo, categoria);
    const dataUrl = await generateImage(prompt);

    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      logger.warn("generarImagenIG: respuesta de Gemini sin formato data URL");
      return null;
    }
    const mimeType = match[1];
    const buffer = Buffer.from(match[2], "base64");

    const ext = mimeType.includes("jpeg") ? "jpg" : mimeType.includes("png") ? "png" : "img";
    const subPath = `ig-covers/${categoria}-${Date.now()}.${ext}`;

    const storage = new ObjectStorageService();
    const url = await storage.uploadBuffer(subPath, buffer, mimeType);

    logger.info({ url, categoria, bytes: buffer.length }, "Imagen IG generada y subida");
    return { url, buffer, mimeType };
  } catch (err) {
    logger.warn({ err }, "generarImagenIG: falló la generación, sigo sin imagen");
    return null;
  }
}
