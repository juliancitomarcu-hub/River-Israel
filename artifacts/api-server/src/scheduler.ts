import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { noticiasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import * as cheerio from "cheerio";
import { ObjectStorageService } from "./lib/objectStorage";
import { logger } from "./lib/logger";

const FUENTES = ["tyc", "ole", "infobae", "clarin", "lanacion", "bolavip", "as", "superdeportivo"] as const;
let fuenteIndex = 0;

const PROMPT_MAESTRO = `Rol: Sos un periodista deportivo argentino de primer nivel, con el estilo narrativo de Juan Pablo Varsky y la profundidad analítica de los grandes referentes del periodismo de River Plate. Escribís para "River en Israel", el sitio web de la comunidad riverplatense en Israel. Tu trabajo es reescribir noticias de River Plate con calidad periodística real.

ESTILO DE ESCRITURA:
- Voz: Periodística, precisa, con peso narrativo. Cada palabra importa. Evitá muletillas, lugares comunes y frases hechas.
- Titular: Debe generar impacto y curiosidad inmediata. No más de 12 palabras. Sin signos de exclamación forzados. El título debe decir algo, no adornar.
- Cuerpo de la nota: Mínimo 4 párrafos sólidos. Cada párrafo agrega información nueva, contexto o análisis.
- Introducción: El primer párrafo engancha al lector de inmediato. Plantea el núcleo de la historia sin rodeos.
- Desarrollo: Ampliá con antecedentes, cifras, contexto histórico, declaraciones (si las hay en la fuente) y análisis de lo que significa para el equipo.
- Usá viñetas (•) solo cuando sea útil para datos concretos.
- Si la noticia menciona un horario de partido en Argentina (ART, UTC-3), calculá el horario israelí sumando 6 horas.
- Tono: Serio y periodístico. Nunca panfletario ni de hinchada.
- PROHIBIDO: No agregues ningún llamado a unirse a la filial, al grupo de WhatsApp ni a ninguna comunidad. La nota termina periodísticamente.

FORMATO DE SALIDA (obligatorio, sin variaciones):

**Título:** [Título periodístico de impacto]

**Contenido:**
[Párrafo de introducción]

[Párrafo de desarrollo/contexto]

[Párrafo de análisis o datos relevantes]

[Párrafo de cierre periodístico — qué sigue, qué está en juego]

**Tags:** #RiverPlate [otros tags relevantes según la noticia]`;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function parsearResultado(texto: string): { titulo: string; contenido: string; tags: string } {
  const tituloMatch = texto.match(/\*\*Título:\*\*\s*(.+)/);
  const tagsMatch = texto.match(/\*\*Tags:\*\*\s*(.+)/);
  const titulo = tituloMatch?.[1]?.trim() ?? "Sin título";
  const tags = tagsMatch?.[1]?.trim() ?? "#RiverPlate #RiverIsrael";
  const contenido = texto
    .replace(/\*\*Título:\*\*\s*.+\n?/, "")
    .replace(/\*\*Contenido:\*\*\s*\n?/, "")
    .replace(/\*\*Tags:\*\*\s*.+\n?/, "")
    .trim();
  return { titulo, contenido, tags };
}

function esImagenGenerica(url: string): boolean {
  if (!url) return true;
  const lower = url.toLowerCase();
  return (
    lower.includes("site_image") ||
    lower.includes("og-default") ||
    lower.includes("og_default") ||
    lower.includes("default-image") ||
    lower.includes("default_image") ||
    lower.includes("placeholder") ||
    lower.includes("/brand/") ||
    lower.includes("/logo") ||
    lower.endsWith("logo.jpg") ||
    lower.endsWith("logo.png") ||
    lower.endsWith("logo.webp") ||
    lower.includes("favicon") ||
    lower.includes("icon.png") ||
    lower.includes("icon.jpg")
  );
}

async function buscarArticuloUrl(seccionUrl: string, tituloNoticia: string): Promise<string | null> {
  try {
    const res = await fetch(seccionUrl, {
      headers: { "User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    const palabrasClave = tituloNoticia.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    let mejorUrl: string | null = null;
    let mejorScore = 0;

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const texto = $(el).text().toLowerCase();
      const hrefLower = href.toLowerCase();
      const score = palabrasClave.filter(p => texto.includes(p) || hrefLower.includes(p)).length;
      if (score > mejorScore && href.length > 10 && !href.startsWith("#")) {
        mejorScore = score;
        mejorUrl = href.startsWith("http") ? href : `${new URL(seccionUrl).origin}${href}`;
      }
    });

    return mejorScore >= 2 ? mejorUrl : null;
  } catch {
    return null;
  }
}

async function obtenerContenidoArticulo(url: string): Promise<{ texto: string; ogImage: string | null }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { texto: "", ogImage: null };

    const html = await res.text();
    const $ = cheerio.load(html);

    const candidatosOg = [
      $('meta[property="og:image:secure_url"]').attr("content"),
      $('meta[property="og:image"]').attr("content"),
      $('meta[name="og:image"]').attr("content"),
      $('meta[name="twitter:image"]').attr("content"),
      $('meta[property="twitter:image"]').attr("content"),
    ].filter(Boolean) as string[];

    let ogImage: string | null = candidatosOg.find(src => !esImagenGenerica(src)) ?? null;

    if (!ogImage) {
      const imgsCuerpo: string[] = [];
      $("article img, .article-body img, .nota-body img, .article__content img, .post-content img, .detail-body img, figure img").each((_, el) => {
        const src = $(el).attr("src") ?? $(el).attr("data-src") ?? $(el).attr("data-lazy-src") ?? "";
        if (src && src.startsWith("http") && !esImagenGenerica(src)) {
          const width = parseInt($(el).attr("width") ?? "0", 10);
          const height = parseInt($(el).attr("height") ?? "0", 10);
          if (width >= 300 || height >= 200 || (!width && !height)) {
            imgsCuerpo.push(src);
          }
        }
      });
      ogImage = imgsCuerpo[0] ?? null;
    }

    const parrafos = $("article p, .article-body p, .nota-body p, .article__content p, .post-content p, .detail-body p")
      .map((_: number, el: cheerio.Element) => $(el).text().trim())
      .get()
      .filter((t: string) => t.length > 50);

    const texto = parrafos.slice(0, 20).join("\n\n");
    return { texto: texto.length > 200 ? texto : "", ogImage };
  } catch {
    return { texto: "", ogImage: null };
  }
}

function extraerNombreProtagonista(titulo: string): string {
  const stopWords = new Set([
    "river","plate","para","desde","tras","ante","esta","este","los","las",
    "del","que","con","por","una","uno","como","pero","hay","muy","más",
    "fue","son","hay","sus","ser","han","van","sin","tal","así","era",
    "estaba","estoy","tengo","nunca","siempre","ahora","después","antes",
    "cuando","donde","quien","cuál","cómo","esto","algo","todo","nada",
    "solo","cada","otro","otra","nuevo","nueva","gran","buen","bien","mal"
  ]);
  // Solo tomamos la parte antes del primer : para evitar frases dentro de comillas
  const partePrincipal = titulo.split(/[:"«]/)[0] ?? titulo;
  const palabras = partePrincipal
    .replace(/[,;¿?¡!]/g, " ")
    .split(/\s+/)
    .filter(p => /^[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]{2,}/.test(p) && !stopWords.has(p.toLowerCase()));
  return palabras.slice(0, 2).join(" ");
}

async function buscarImagenWikipedia(termino: string): Promise<string | null> {
  if (!termino || termino.length < 4) return null;
  try {
    // Primero buscar sin "River Plate" para obtener la foto del jugador directamente
    const query = encodeURIComponent(termino);
    const url = `https://es.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${query}&prop=pageimages&format=json&pithumbsize=1600&gsrlimit=5&origin=*`;
    const res = await fetch(url, {
      headers: { "User-Agent": "RiverEnIsrael/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { query?: { pages?: Record<string, { thumbnail?: { source: string } }> } };
    const pages = data.query?.pages;
    if (!pages) return null;

    const imagenes = Object.values(pages)
      .map(p => p.thumbnail?.source)
      .filter(Boolean)
      .filter((src): src is string => {
        if (!src) return false;
        const lower = src.toLowerCase();
        // Excluir logos SVG, escudos y banderas
        return !lower.includes(".svg") &&
               !lower.includes("logo") &&
               !lower.includes("escudo") &&
               !lower.includes("flag") &&
               !lower.includes("bandera") &&
               !lower.includes("coat_of_arms");
      });

    return imagenes[0] ?? null;
  } catch {
    return null;
  }
}

async function subirImagenDesdeUrl(imageUrl: string): Promise<string | null> {
  try {
    const imgRes = await fetch(imageUrl, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(20000),
    });
    if (!imgRes.ok) return null;

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return null;

    const imgBuffer = await imgRes.arrayBuffer();
    if (imgBuffer.byteLength < 5000) return null;

    const storageService = new ObjectStorageService();
    const uploadUrl = await storageService.getObjectEntityUploadURL();

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: imgBuffer,
      signal: AbortSignal.timeout(30000),
    });

    if (!putRes.ok) return null;

    return storageService.normalizeObjectEntityPath(uploadUrl);
  } catch {
    return null;
  }
}

async function ejecutarCiclo(): Promise<void> {
  const fuente = FUENTES[fuenteIndex % FUENTES.length];
  fuenteIndex++;

  logger.info({ fuente, fuenteIndex }, "Scheduler: iniciando ciclo automático");

  try {
    const port = process.env.PORT;
    const noticiasRes = await fetch(`http://localhost:${port}/api/noticias-river?fuente=${fuente}`, {
      signal: AbortSignal.timeout(35000),
    });

    if (!noticiasRes.ok) {
      logger.warn({ fuente, status: noticiasRes.status }, "Scheduler: scraping falló");
      return;
    }

    const data = await noticiasRes.json() as { noticias?: { titulo: string; url: string; fuente: string }[] };
    const noticias = data.noticias ?? [];

    if (!noticias.length) {
      logger.warn({ fuente }, "Scheduler: no se encontraron noticias");
      return;
    }

    const noticia = noticias[0];
    logger.info({ titulo: noticia.titulo, url: noticia.url }, "Scheduler: noticia seleccionada");

    let textoParaIA = noticia.titulo;
    let ogImage: string | null = null;

    if (noticia.url) {
      let urlArticulo = noticia.url;

      const esSeccion = /\.(html?|com\.ar|com)\/?$/.test(noticia.url) ||
        noticia.url.split("/").filter(Boolean).length <= 3;

      if (esSeccion) {
        const urlEspecifica = await buscarArticuloUrl(noticia.url, noticia.titulo);
        if (urlEspecifica) {
          logger.info({ urlEspecifica }, "Scheduler: URL de artículo específico encontrada");
          urlArticulo = urlEspecifica;
        }
      }

      const { texto, ogImage: img } = await obtenerContenidoArticulo(urlArticulo);
      if (texto) textoParaIA = `${noticia.titulo}\n\n${texto}`;
      ogImage = img;

      if (!ogImage && urlArticulo !== noticia.url) {
        const { ogImage: imgSeccion } = await obtenerContenidoArticulo(noticia.url);
        ogImage = imgSeccion;
      }
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2000,
      messages: [
        { role: "system", content: PROMPT_MAESTRO },
        { role: "user", content: `Transformá esta noticia para el sitio River en Israel:\n\n${textoParaIA}` },
      ],
    });

    const resultado = completion.choices[0]?.message?.content ?? "";
    if (!resultado || resultado.length < 50) {
      logger.error("Scheduler: la IA no generó contenido");
      return;
    }

    const { titulo, contenido, tags } = parsearResultado(resultado);

    if (!ogImage) {
      const protagonista = extraerNombreProtagonista(noticia.titulo);
      if (protagonista) {
        logger.info({ protagonista }, "Scheduler: buscando imagen en Wikipedia");
        const wikiImg = await buscarImagenWikipedia(protagonista);
        if (wikiImg) {
          logger.info({ wikiImg }, "Scheduler: imagen Wikipedia encontrada");
          ogImage = wikiImg;
        }
      }
    }

    let imagenPortada = "";
    if (ogImage) {
      logger.info({ ogImage }, "Scheduler: subiendo imagen de portada");
      const objectPath = await subirImagenDesdeUrl(ogImage);
      if (objectPath) {
        imagenPortada = objectPath;
        logger.info({ objectPath }, "Scheduler: imagen subida");
      }
    }

    const [savedNoticia] = await db
      .insert(noticiasTable)
      .values({
        titulo,
        contenido,
        tags,
        textoOriginal: textoParaIA.slice(0, 3000),
        fuente: noticia.fuente ?? fuente,
        publicada: false,
        pendiente: true,
        imagenPortada,
      })
      .returning();

    const token = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const domain = process.env.REPLIT_DEV_DOMAIN;

    if (!token || !chatId) {
      logger.warn("Scheduler: Telegram no configurado, nota guardada sin enviar");
      return;
    }

    const replyMarkup = {
      inline_keyboard: [[
        { text: "✅ Publicar", callback_data: `publicar_${savedNoticia.id}` },
        { text: "✏️ Editar", callback_data: `editar_${savedNoticia.id}` },
        { text: "❌ Rechazar", callback_data: `rechazar_${savedNoticia.id}` },
      ]],
    };

    let tgRes: Response;

    if (imagenPortada) {
      const encabezado = `🤖 *AUTO — River en Israel*\n\n*${titulo}*\n\n`;
      const pie = `\n\n${tags}\n\n_¿Publicamos esta nota en el sitio?_`;
      const maxContenido = 1024 - encabezado.length - pie.length - 3;
      const contenidoRecortado = contenido.length > maxContenido
        ? contenido.slice(0, maxContenido) + "..."
        : contenido;
      const caption = encabezado + contenidoRecortado + pie;

      try {
        // Descargamos la imagen localmente y la enviamos como binario a Telegram
        const port = process.env.PORT;
        const imgRes = await fetch(`http://localhost:${port}/api/storage${imagenPortada}`, {
          signal: AbortSignal.timeout(15000),
        });

        if (imgRes.ok) {
          const imgBuffer = await imgRes.arrayBuffer();
          const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
          const form = new FormData();
          form.append("chat_id", chatId);
          form.append("caption", caption);
          form.append("parse_mode", "Markdown");
          form.append("reply_markup", JSON.stringify(replyMarkup));
          form.append("photo", new Blob([imgBuffer], { type: contentType }), "portada.jpg");

          tgRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
            method: "POST",
            body: form,
          });
        } else {
          throw new Error("No se pudo descargar la imagen local");
        }
      } catch (imgErr) {
        logger.warn({ imgErr }, "Scheduler: error con imagen, enviando sin foto");
        const mensajeTexto =
          `🤖 *AUTO — River en Israel*\n\n` +
          `*${titulo}*\n\n` +
          `${contenido.slice(0, 700)}${contenido.length > 700 ? "..." : ""}\n\n` +
          `${tags}\n\n` +
          `_¿Publicamos esta nota en el sitio?_`;

        tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: mensajeTexto, parse_mode: "Markdown", reply_markup: replyMarkup }),
        });
      }
    } else {
      const mensajeTexto =
        `🤖 *AUTO — River en Israel*\n\n` +
        `*${titulo}*\n\n` +
        `${contenido.slice(0, 700)}${contenido.length > 700 ? "..." : ""}\n\n` +
        `${tags}\n\n` +
        `_¿Publicamos esta nota en el sitio?_`;

      tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: mensajeTexto, parse_mode: "Markdown", reply_markup: replyMarkup }),
      });
    }

    const tgData = await tgRes.json() as { ok: boolean; result?: { message_id: number } };

    if (!tgRes.ok || !tgData.ok) {
      logger.error({ tgData }, "Scheduler: error enviando a Telegram");
      return;
    }

    const messageId = String(tgData.result?.message_id ?? "");
    if (messageId) {
      await db
        .update(noticiasTable)
        .set({ telegramMessageId: messageId })
        .where(eq(noticiasTable.id, savedNoticia.id));
    }

    logger.info({ titulo, id: savedNoticia.id, fuente }, "Scheduler: ciclo completado correctamente");

  } catch (err) {
    logger.error({ err }, "Scheduler: error inesperado en ciclo automático");
  }
}

export { ejecutarCiclo };

const INTERVALO_MS = 2 * 60 * 60 * 1000; // 2 horas
const PRIMER_CICLO_MS = 30 * 60 * 1000;  // 30 minutos tras arrancar el servidor

export function iniciarScheduler(): void {
  logger.info({ primerCicloMinutos: 30, intervalHoras: 2 }, "Scheduler automático iniciado — primer ciclo en 30 min");

  setTimeout(function ciclo() {
    ejecutarCiclo().catch((err) => logger.error({ err }, "Scheduler: error no capturado"));
    setTimeout(ciclo, INTERVALO_MS);
  }, PRIMER_CICLO_MS);
}
