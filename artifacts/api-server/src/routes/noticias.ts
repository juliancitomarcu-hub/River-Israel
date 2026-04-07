import { Router, type IRouter } from "express";
import * as cheerio from "cheerio";

const router: IRouter = Router();

interface NoticiaRaw {
  titulo: string;
  url: string;
  fuente: string;
}

// ─── FILTRO RIVER: palabras que CONFIRMAN que es de River ─────────────────────
const PALABRAS_RIVER = [
  "river", "millonario", "millo", "coudet", "bandito", "monumental",
  "gallardo", "muñeco", "núñez", "banda", "colidio", "borja", "ramirez",
  "tobias", "nacho", "libertadores", "filial", "superclasico", "clasico",
  "enzo", "pitón", "mastantuono", "zuculini", "demichelis", "borre",
  "river plate", "el millo", "el más grande", "mas grande", "millonaria"
];

// ─── FILTRO ANTIHUMO: palabras que descartan la noticia automáticamente ───────
const PALABRAS_NEGATIVAS = [
  "boca juniors", "boca jr", "bocajuniors", "xeneize",
  "racing club", "independiente", "san lorenzo", "huracán",
  "newells", "estudiantes", "velez", "tigre", "belgrano",
  "formula 1", "formula uno", "nba", "nfl", "rugby", "tenis",
  "atletismo", "natacion", "boxeo", "ufc", "mma"
];

function esNoticiaDeRiver(titulo: string, url: string): boolean {
  const textoLower = titulo.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const urlLower = url.toLowerCase();

  // Descartar si tiene keywords negativas
  for (const neg of PALABRAS_NEGATIVAS) {
    const negNorm = neg.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (textoLower.includes(negNorm)) return false;
  }

  // Aceptar si la URL ya apunta a River
  if (
    urlLower.includes("/river-plate") ||
    urlLower.includes("/river_plate") ||
    urlLower.includes("/river/") ||
    urlLower.includes("tag/river") ||
    urlLower.includes("lapaginamillonaria")
  ) return true;

  // Aceptar si el título tiene palabras de River
  const textoOriginal = titulo.toLowerCase();
  return PALABRAS_RIVER.some((p) =>
    textoOriginal.includes(p) ||
    textoLower.includes(p.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
  );
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function scrapearSitio(
  url: string,
  baseUrl: string,
  fuente: string
): Promise<NoticiaRaw[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-AR,es;q=0.9",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`${fuente} respondió ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const todas: NoticiaRaw[] = [];

  $("h1, h2, h3, h4").each((_, el) => {
    const texto = $(el).text().trim();
    if (texto.length < 20 || texto.length > 250) return;

    const link =
      $(el).find("a").attr("href") ??
      $(el).closest("a").attr("href") ??
      $(el).parent().find("a").attr("href") ??
      "";
    const fullUrl = link.startsWith("http") ? link : link ? `${baseUrl}${link}` : "";

    if (!todas.find((n) => n.titulo === texto)) {
      todas.push({ titulo: texto, url: fullUrl, fuente });
    }
  });

  const deRiver = todas.filter((n) => esNoticiaDeRiver(n.titulo, n.url));
  return (deRiver.length >= 3 ? deRiver : todas.filter((n) => esNoticiaDeRiver(n.titulo, n.url))).slice(0, 8);
}

// ─── FUENTES ─────────────────────────────────────────────────────────────────

// 🏆 PRIORITARIA: La Página Millonaria — el diario oficial de los hinchas de River
async function scrapearPaginaMillonaria(): Promise<NoticiaRaw[]> {
  const intentos = [
    "https://www.lapaginamillonaria.com/",
    "https://www.lapaginamillonaria.com/river-plate/",
  ];
  for (const url of intentos) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, "Accept": "text/html,*/*", "Accept-Language": "es-AR,es;q=0.9" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);
      const noticias: NoticiaRaw[] = [];

      // La Página Millonaria usa estructura de blog con títulos en a > h2 o article a
      $("h1 a, h2 a, h3 a, .entry-title a, .post-title a, article a[rel='bookmark']").each((_, el) => {
        const texto = $(el).text().trim();
        const href = $(el).attr("href") ?? "";
        if (texto.length > 20 && texto.length < 250 && href && !noticias.find((n) => n.titulo === texto)) {
          noticias.push({ titulo: texto, url: href.startsWith("http") ? href : `https://www.lapaginamillonaria.com${href}`, fuente: "La Página Millonaria" });
        }
      });

      // Fallback: buscar todos los h tags
      if (noticias.length < 3) {
        $("h1, h2, h3").each((_, el) => {
          const texto = $(el).text().trim();
          const link = $(el).find("a").attr("href") ?? $(el).closest("a").attr("href") ?? "";
          if (texto.length > 20 && texto.length < 250 && !noticias.find((n) => n.titulo === texto)) {
            const fullUrl = link.startsWith("http") ? link : link ? `https://www.lapaginamillonaria.com${link}` : "";
            noticias.push({ titulo: texto, url: fullUrl, fuente: "La Página Millonaria" });
          }
        });
      }

      // Todo lo de LPM es de River, solo filtrar negativos
      const filtradas = noticias.filter((n) => {
        const textoLower = n.titulo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return !PALABRAS_NEGATIVAS.some((neg) => textoLower.includes(neg.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
      });

      if (filtradas.length >= 2) return filtradas.slice(0, 10);
    } catch { /* siguiente intento */ }
  }
  throw new Error("La Página Millonaria no respondió");
}

async function scrapearTyC(): Promise<NoticiaRaw[]> {
  return scrapearSitio("https://www.tycsports.com/river-plate", "https://www.tycsports.com", "TyC Sports");
}

async function scrapearOle(): Promise<NoticiaRaw[]> {
  return scrapearSitio("https://www.ole.com.ar/river-plate/", "https://www.ole.com.ar", "Olé");
}

async function scrapearInfobae(): Promise<NoticiaRaw[]> {
  return scrapearSitio("https://www.infobae.com/tag/river-plate/", "https://www.infobae.com", "Infobae");
}

async function scrapearClarin(): Promise<NoticiaRaw[]> {
  const url = "https://www.clarin.com/tag/river-plate.html";
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "text/html,*/*", "Accept-Language": "es-AR,es;q=0.9" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Clarín respondió ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const noticias: NoticiaRaw[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text()) as { itemListElement?: { name?: string; url?: string }[] };
      if (data.itemListElement) {
        for (const item of data.itemListElement) {
          if (item.name && item.url && item.name.length > 20) {
            const fullUrl = item.url.startsWith("http") ? item.url : `https://www.clarin.com${item.url}`;
            if (!noticias.find((n) => n.titulo === item.name)) {
              noticias.push({ titulo: item.name!, url: fullUrl, fuente: "Clarín" });
            }
          }
        }
      }
    } catch { /* skip malformed */ }
  });

  if (noticias.length > 0) {
    const filtradas = noticias.filter((n) => esNoticiaDeRiver(n.titulo, n.url));
    return (filtradas.length > 0 ? filtradas : noticias).slice(0, 8);
  }
  return scrapearSitio(url, "https://www.clarin.com", "Clarín");
}

async function scrapearLaNacion(): Promise<NoticiaRaw[]> {
  const intentos = [
    "https://www.lanacion.com.ar/deportes/futbol/river-plate/",
    "https://www.lanacion.com.ar/deportes/futbol/",
  ];
  for (const url of intentos) {
    try {
      const result = await scrapearSitio(url, "https://www.lanacion.com.ar", "La Nación");
      if (result.length >= 2) return result;
    } catch { /* siguiente */ }
  }
  throw new Error("La Nación no respondió");
}

async function scrapearBolavip(): Promise<NoticiaRaw[]> {
  return scrapearSitio("https://bolavip.com/ar/river/", "https://bolavip.com", "Bolavip");
}

async function scrapearAS(): Promise<NoticiaRaw[]> {
  return scrapearSitio("https://argentina.as.com/tag/river_plate/", "https://argentina.as.com", "AS Argentina");
}

async function scrapearSuperDeportivo(): Promise<NoticiaRaw[]> {
  return scrapearSitio("https://www.superdeportivo.com.ar/river-plate", "https://www.superdeportivo.com.ar", "SuperDeportivo");
}

// ─── SITIO OFICIAL: cariverplate.com.ar ───────────────────────────────────────
// Usa cheerio (HTML estático). No requiere navegador headless.
// La portada expone noticias con href + title en los <a> tags.
async function scrapearCARiverPlate(): Promise<NoticiaRaw[]> {
  const BASE = "https://www.cariverplate.com.ar";
  const SKIP_PATTERNS = ["estadisticas-de-", "video-goles-", "video-resumen-", "desde-la-tribuna"];

  const res = await fetch(BASE + "/", {
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
      "Accept-Language": "es-AR,es;q=0.9",
      "Referer": BASE,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`cariverplate.com.ar respondió ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const noticias: NoticiaRaw[] = [];

  // Busca todos los <a href title> cuyo href parece un artículo (slug con guiones, año en URL)
  $("a[href][title]").each((_, el) => {
    const href  = $(el).attr("href") ?? "";
    const title = $(el).attr("title")?.trim() ?? "";

    if (!title || title.length < 15 || title.length > 250) return;
    // Las noticias de cariverplate.com.ar siempre tienen el año en el slug (ej: "-2026" al final)
    // Esto las distingue de páginas de sección como /comision-de-derechos-humanos
    const esNoticia = /20\d\d/.test(href);
    if (!esNoticia) return;
    // Filtrar páginas que no son artículos de noticias
    if (SKIP_PATTERNS.some(p => href.includes(p))) return;

    const fullUrl = href.startsWith("/") ? `${BASE}${href}` : `${BASE}/${href}`;
    if (!noticias.find((n) => n.url === fullUrl)) {
      noticias.push({ titulo: title, url: fullUrl, fuente: "CA River Plate Oficial" });
    }
  });

  // También buscar títulos en h2/h3 dentro del header de noticias
  $("#noticias-header h1, #noticias-header h2, #noticias-header h3, #noticias-header h4").each((_, el) => {
    const texto = $(el).text().trim();
    const link  = $(el).find("a").attr("href") ?? $(el).closest("a").attr("href") ?? "";
    if (!texto || texto.length < 15 || !link) return;
    const fullUrl = link.startsWith("/") ? `${BASE}${link}` : `${BASE}/${link}`;
    if (!noticias.find((n) => n.url === fullUrl || n.titulo === texto)) {
      noticias.push({ titulo: texto, url: fullUrl, fuente: "CA River Plate Oficial" });
    }
  });

  if (noticias.length === 0) throw new Error("cariverplate.com.ar: no se encontraron noticias");

  // Todo el sitio es sobre River, solo filtramos negativos
  const filtradas = noticias.filter((n) => {
    const t = n.titulo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return !PALABRAS_NEGATIVAS.some((neg) => t.includes(neg.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
  });

  return (filtradas.length >= 2 ? filtradas : noticias).slice(0, 10);
}

// ─── GOOGLE NEWS RSS ──────────────────────────────────────────────────────────
async function scrapearGoogleNews(): Promise<NoticiaRaw[]> {
  const url = "https://news.google.com/rss/search?q=River+Plate+when:24h&hl=es-419&gl=AR&ceid=AR:es-419";
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "application/rss+xml, text/xml, */*" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Google News respondió ${res.status}`);

  const xml = await res.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  const noticias: NoticiaRaw[] = [];

  $("item").each((_, el) => {
    const titulo = $(el).find("title").text().trim();
    const link   = $(el).find("link").text().trim() || $(el).find("guid").text().trim();
    const fuente = $(el).find("source").text().trim() || "Google News";

    if (titulo && titulo.length > 20 && titulo.length < 250 && esNoticiaDeRiver(titulo, link)) {
      if (!noticias.find((n) => n.titulo === titulo)) {
        noticias.push({ titulo, url: link, fuente });
      }
    }
  });

  return noticias.slice(0, 12);
}

// ─── MAP fuente ───────────────────────────────────────────────────────────────

const FUENTES: Record<string, () => Promise<NoticiaRaw[]>> = {
  pagina: scrapearPaginaMillonaria,
  tyc: scrapearTyC,
  ole: scrapearOle,
  infobae: scrapearInfobae,
  clarin: scrapearClarin,
  lanacion: scrapearLaNacion,
  bolavip: scrapearBolavip,
  as: scrapearAS,
  superdeportivo: scrapearSuperDeportivo,
  google: scrapearGoogleNews,
  cariverplate: scrapearCARiverPlate,
};

// ─── ENDPOINT ─────────────────────────────────────────────────────────────────

router.get("/noticias-river", async (req, res) => {
  const fuente = (req.query.fuente as string) ?? "pagina";
  const scraper = FUENTES[fuente] ?? scrapearPaginaMillonaria;

  try {
    const noticias = await scraper();

    if (noticias.length === 0) {
      res.status(404).json({ error: "No se encontraron noticias. El sitio puede tener protección anti-bots." });
      return;
    }

    res.json({ noticias });
  } catch (err) {
    req.log.error({ err }, "Error scrapeando noticias");
    res.status(500).json({ error: "No se pudo conectar con la fuente de noticias" });
  }
});

export default router;
