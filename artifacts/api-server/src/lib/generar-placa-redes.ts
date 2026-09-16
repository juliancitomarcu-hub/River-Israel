import { createHash } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ObjectStorageService } from "./objectStorage";
import { urlImagenSeguraAsync } from "./url-imagen-segura";

const ANCHO_PLACA = 1080;
const ALTO_PLACA = 1080;
const MAX_BYTES_FOTO = 15 * 1024 * 1024;
const MAX_REDIRECTS = 8;
const MAX_LARGO_TITULO = 600;
const ANCHO_TITULO = 936;
const ALTO_TITULO = 530;
const TAMANO_FUENTE_MINIMO = 36;
const FONT_FAMILY = "DejaVu Sans, Arial, sans-serif";

type FetchResponse = globalThis.Response;

/**
 * Escapa texto para insertarlo como texto de un documento SVG. No se usa
 * innerHTML ni se aceptan recursos externos en el SVG, para que el render sea
 * siempre reproducible.
 */
function escaparSvg(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizarTitulo(titulo: string): string {
  if (typeof titulo !== "string") {
    throw new Error("renderizarPlacaRedes: el título debe ser un texto");
  }

  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(titulo)) {
    throw new Error("renderizarPlacaRedes: el título contiene caracteres no válidos");
  }

  const normalizado = titulo.trim().replace(/\s+/gu, " ");
  if (!normalizado) {
    throw new Error("renderizarPlacaRedes: el título no puede estar vacío");
  }
  if (Array.from(normalizado).length > MAX_LARGO_TITULO) {
    throw new Error(
      `renderizarPlacaRedes: el título supera el máximo de ${MAX_LARGO_TITULO} caracteres`,
    );
  }
  return normalizado;
}

/**
 * La estimación deliberadamente es conservadora. Así una línea que entra en
 * esta caja también entra en DejaVu Sans Bold (la fuente instalada en la
 * imagen del servidor), sin depender de medidas que puedan variar entre
 * versiones de librsvg.
 */
function anchoAproximado(texto: string, tamanoFuente: number): number {
  let ancho = 0;
  for (const caracter of Array.from(texto)) {
    if (/\s/u.test(caracter)) {
      ancho += tamanoFuente * 0.34;
    } else if (/[\u0300-\u036F]/u.test(caracter)) {
      ancho += tamanoFuente * 0.08;
    } else if (/[ilI1.,:;!'|`´-]/u.test(caracter)) {
      ancho += tamanoFuente * 0.36;
    } else if (/[MW@#%&]/u.test(caracter)) {
      ancho += tamanoFuente * 0.98;
    } else if (/[\u2E80-\u9FFF\uAC00-\uD7AF]/u.test(caracter)) {
      ancho += tamanoFuente * 0.92;
    } else {
      ancho += tamanoFuente * 0.72;
    }
  }
  return ancho;
}

function partirPalabra(palabra: string, tamanoFuente: number): string[] {
  if (anchoAproximado(palabra, tamanoFuente) <= ANCHO_TITULO) {
    return [palabra];
  }

  const partes: string[] = [];
  let parte = "";
  for (const caracter of Array.from(palabra)) {
    const candidata = `${parte}${caracter}`;
    if (parte && anchoAproximado(candidata, tamanoFuente) > ANCHO_TITULO) {
      partes.push(parte);
      parte = caracter;
    } else {
      parte = candidata;
    }
  }
  if (parte) partes.push(parte);
  return partes;
}

function envolverTitulo(titulo: string, tamanoFuente: number): string[] {
  const palabras = titulo.split(" ");
  const lineas: string[] = [];
  let linea = "";

  for (const palabra of palabras) {
    const partes = partirPalabra(palabra, tamanoFuente);
    for (const [indiceParte, parte] of partes.entries()) {
      // Entre palabras hay un espacio; al cortar una palabra muy larga entre
      // líneas no se agrega uno, para no alterar el texto del título.
      const separador = linea && indiceParte === 0 ? " " : "";
      const candidata = `${linea}${separador}${parte}`;
      if (linea && anchoAproximado(candidata, tamanoFuente) > ANCHO_TITULO) {
        lineas.push(linea);
        linea = parte;
      } else {
        linea = candidata;
      }
    }
  }
  if (linea) lineas.push(linea);
  return lineas;
}

function obtenerDisenoTitulo(titulo: string): {
  lineas: string[];
  tamanoFuente: number;
  altoLinea: number;
} {
  for (let tamanoFuente = 112; tamanoFuente >= TAMANO_FUENTE_MINIMO; tamanoFuente -= 2) {
    const lineas = envolverTitulo(titulo, tamanoFuente);
    const altoLinea = Math.ceil(tamanoFuente * 1.08);
    if (
      lineas.length > 0 &&
      lineas.every((linea) => anchoAproximado(linea, tamanoFuente) <= ANCHO_TITULO) &&
      lineas.length * altoLinea <= ALTO_TITULO
    ) {
      return { lineas, tamanoFuente, altoLinea };
    }
  }

  // Nunca se corta un título para hacer que entre en la placa. Es preferible
  // fallar explícitamente a publicar una placa con información incompleta.
  throw new Error("renderizarPlacaRedes: el título es demasiado largo para la placa");
}

function construirSvgPlaca(titulo: string): Buffer {
  const diseno = obtenerDisenoTitulo(titulo);
  const yFinal = 906;
  const yInicial = yFinal - (diseno.lineas.length - 1) * diseno.altoLinea;
  const texto = diseno.lineas
    .map(
      (linea, indice) =>
        `<text x="72" y="${yInicial + indice * diseno.altoLinea}" ` +
        `fill="#ffffff" stroke="#050505" stroke-width="3" stroke-linejoin="round" ` +
        `paint-order="stroke fill" font-family="${FONT_FAMILY}" ` +
        `font-size="${diseno.tamanoFuente}" font-weight="700">${escaparSvg(linea)}</text>`,
    )
    .join("");

  const svg = `
    <svg width="${ANCHO_PLACA}" height="${ALTO_PLACA}" viewBox="0 0 ${ANCHO_PLACA} ${ALTO_PLACA}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gradienteInferior" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
          <stop offset="38%" stop-color="#000000" stop-opacity=".20"/>
          <stop offset="70%" stop-color="#000000" stop-opacity=".78"/>
          <stop offset="100%" stop-color="#000000" stop-opacity=".96"/>
        </linearGradient>
      </defs>
      <rect x="0" y="230" width="${ANCHO_PLACA}" height="850" fill="url(#gradienteInferior)"/>
      <rect x="72" y="${yInicial - diseno.tamanoFuente - 18}" width="92" height="8" rx="4" fill="#c8102e"/>
      ${texto}
      <text x="72" y="1032" fill="#ffffff" stroke="#050505" stroke-width="1.5" paint-order="stroke fill"
        font-family="${FONT_FAMILY}" font-size="28" font-weight="700" letter-spacing=".4">riverplateisrael.com</text>
    </svg>`;
  return Buffer.from(svg);
}

/**
 * Renderiza una portada editorial a partir de la foto real recibida. Sharp
 * hace el recorte cover y el SVG únicamente aporta el tratamiento gráfico y
 * el texto, sin generar o alterar la fotografía.
 */
export async function renderizarPlacaRedes(foto: Buffer, titulo: string): Promise<Buffer> {
  if (!Buffer.isBuffer(foto) || foto.length === 0) {
    throw new Error("renderizarPlacaRedes: falta la foto de portada");
  }

  const tituloNormalizado = normalizarTitulo(titulo);
  const svg = construirSvgPlaca(tituloNormalizado);
  return sharp(foto, { limitInputPixels: 100_000_000 })
    .rotate()
    .resize(ANCHO_PLACA, ALTO_PLACA, { fit: "cover", position: "attention" })
    .composite([{ input: svg, blend: "over" }])
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

async function leerBufferLimitado(response: FetchResponse): Promise<Buffer> {
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BYTES_FOTO) {
    throw new Error("generarPlacaRedes: la foto supera el máximo de 15 MB");
  }

  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) {
      throw new Error("generarPlacaRedes: la descarga de la foto está vacía");
    }
    if (buffer.length > MAX_BYTES_FOTO) {
      throw new Error("generarPlacaRedes: la foto supera el máximo de 15 MB");
    }
    return buffer;
  }

  const reader = response.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_BYTES_FOTO) {
        throw new Error("generarPlacaRedes: la foto supera el máximo de 15 MB");
      }
      partes.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (total === 0) {
    throw new Error("generarPlacaRedes: la descarga de la foto está vacía");
  }
  return Buffer.concat(partes.map((parte) => Buffer.from(parte)), total);
}

async function descargarFotoSegura(urlInicial: string): Promise<Buffer> {
  let urlActual = urlInicial;
  for (let intento = 0; intento <= MAX_REDIRECTS; intento += 1) {
    // Se valida antes de cada request, incluyendo el destino de cada redirect.
    if (!(await urlImagenSeguraAsync(urlActual))) {
      throw new Error(`generarPlacaRedes: URL de foto no permitida (${urlActual})`);
    }

    const response = await fetch(urlActual, {
      redirect: "manual",
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8" },
      signal: AbortSignal.timeout(20_000),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("generarPlacaRedes: la foto redirige sin destino");
      }
      if (intento === MAX_REDIRECTS) {
        throw new Error("generarPlacaRedes: demasiadas redirecciones al descargar la foto");
      }
      try {
        urlActual = new URL(location, urlActual).toString();
      } catch {
        throw new Error("generarPlacaRedes: la redirección de la foto no es válida");
      }
      continue;
    }

    if (!response.ok) {
      throw new Error(`generarPlacaRedes: no se pudo descargar la foto (HTTP ${response.status})`);
    }

    const contentType = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (contentType && !contentType.startsWith("image/")) {
      throw new Error(`generarPlacaRedes: la respuesta no es una imagen (${contentType})`);
    }
    return leerBufferLimitado(response);
  }

  throw new Error("generarPlacaRedes: no se pudo descargar la foto");
}

function unirBaseUrl(baseUrl: string, ruta: string): string {
  const base = baseUrl.trim().replace(/\/+$/u, "");
  if (!/^https?:\/\//iu.test(base)) {
    throw new Error("generarPlacaRedes: baseUrl debe ser una URL http(s)");
  }
  return `${base}${ruta.startsWith("/") ? ruta : `/${ruta}`}`;
}

function rutaPortadaAUrl(imagenPortada: string, baseUrl: string): string {
  const ruta = imagenPortada.trim();
  if (!ruta) {
    throw new Error("generarPlacaRedes: falta la foto de portada");
  }

  if (/^https?:\/\//iu.test(ruta)) return ruta;
  if (ruta.startsWith("/objects/")) {
    return unirBaseUrl(baseUrl, `/api/storage${ruta}`);
  }
  if (ruta === "/images" || ruta.startsWith("/images/")) {
    return unirBaseUrl(baseUrl, ruta);
  }

  throw new Error(
    "generarPlacaRedes: la foto debe ser una URL http(s), una ruta /objects/ o una ruta /images/",
  );
}

function rutasPublicasPosibles(): string[] {
  const moduloDir = path.dirname(fileURLToPath(import.meta.url));
  return [
    path.resolve(process.cwd(), "artifacts/river-en-israel/public"),
    path.resolve(process.cwd(), "artifacts/river-en-israel/dist/public"),
    path.resolve(process.cwd(), "river-en-israel/public"),
    path.resolve(process.cwd(), "public"),
    path.resolve(moduloDir, "../../river-en-israel/public"),
    path.resolve(moduloDir, "../../../river-en-israel/public"),
  ];
}

async function encontrarPublicFrontend(): Promise<string> {
  for (const candidato of rutasPublicasPosibles()) {
    try {
      if ((await stat(candidato)).isDirectory()) return candidato;
    } catch {
      // Se prueban los demás layouts posibles (source, dist y producción).
    }
  }
  throw new Error("generarPlacaRedes: no se encontró la carpeta public del frontend");
}

export interface NotaParaPlacaRedes {
  id: number;
  titulo: string;
  imagenPortada?: string | null;
}

export async function generarPlacaRedes(
  nota: NotaParaPlacaRedes,
  baseUrl: string,
): Promise<{ url: string; filePath: string }> {
  if (!nota || !Number.isInteger(nota.id) || nota.id <= 0) {
    throw new Error("generarPlacaRedes: la nota no tiene un ID válido");
  }
  if (!nota.imagenPortada?.trim()) {
    throw new Error("generarPlacaRedes: la nota no tiene foto de portada");
  }

  const fotoUrl = rutaPortadaAUrl(nota.imagenPortada, baseUrl);
  const foto = await descargarFotoSegura(fotoUrl);
  const placa = await renderizarPlacaRedes(foto, nota.titulo);

  const hash = createHash("sha256").update(placa).digest("hex");
  const nombre = `${hash}.jpg`;
  const publicFrontend = await encontrarPublicFrontend();
  const directorioPlacas = path.join(publicFrontend, "placas");
  const filePath = path.join(directorioPlacas, nombre);
  await mkdir(directorioPlacas, { recursive: true });
  await writeFile(filePath, placa);

  const objectPath = `placas/${nombre}`;
  const objectPathPublico = await new ObjectStorageService().uploadBuffer(
    objectPath,
    placa,
    "image/jpeg",
  );
  return {
    url: unirBaseUrl(baseUrl, `/api/storage${objectPathPublico}`),
    filePath,
  };
}