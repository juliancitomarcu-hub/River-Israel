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
  // Tipos de páginas que NO son artículos editoriales
  const SKIP_PATTERNS = [
    "estadisticas-de-", "video-goles-", "video-resumen-", "video-",
    "desde-la-tribuna", "comision-directiva-",
  ];

  const HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
    "Accept-Language": "es-AR,es;q=0.9",
    "Referer": BASE,
  };

  const normalizar = (href: string) =>
    href.startsWith("http") ? href :
    href.startsWith("/")    ? `${BASE}${href}` :
                              `${BASE}/${href}`;

  const extraerDeHtml = (html: string, acumuladas: NoticiaRaw[]) => {
    const $ = cheerio.load(html);

    // Selector principal: <a class="titulo"> — indica un enlace de artículo en la maqueta del sitio
    $("a.titulo[href]").each((_, el) => {
      const href  = $(el).attr("href") ?? "";
      const title = ($(el).attr("title") ?? $(el).text()).trim();

      if (!title || title.length < 10 || title.length > 300) return;
      if (SKIP_PATTERNS.some(p => href.includes(p))) return;

      const url = normalizar(href);
      if (!acumuladas.find(n => n.url === url)) {
        acumuladas.push({ titulo: title, url, fuente: "CA River Plate Oficial" });
      }
    });

    // Complemento: <a href title> con año en la URL (captura artículos destacados sin class="titulo")
    $("a[href][title]").each((_, el) => {
      const href  = $(el).attr("href") ?? "";
      const title = $(el).attr("title")?.trim() ?? "";

      if (!title || title.length < 10 || title.length > 300) return;
      if (!/20\d\d/.test(href)) return;                        // solo URLs con año
      if (SKIP_PATTERNS.some(p => href.includes(p))) return;
      if (title === "Ver fotos" || title === "Ver video") return; // botones, no artículos

      const url = normalizar(href);
      if (!acumuladas.find(n => n.url === url)) {
        acumuladas.push({ titulo: title, url, fuente: "CA River Plate Oficial" });
      }
    });
  };

  // ── Paso 1: página principal ──────────────────────────────────────────────
  const noticias: NoticiaRaw[] = [];

  const resHome = await fetch(BASE + "/", { headers: HEADERS, signal: AbortSignal.timeout(15000) });
  if (resHome.ok) extraerDeHtml(await resHome.text(), noticias);

  // ── Paso 2: página de todas las noticias (amplía el listado) ─────────────
  const resTodas = await fetch(`${BASE}/todas-las-noticias`, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
  if (resTodas.ok) extraerDeHtml(await resTodas.text(), noticias);

  if (noticias.length === 0) throw new Error("cariverplate.com.ar: no se encontraron noticias");

  return noticias.slice(0, 15);
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

// ════════════════════════════════════════════════════════════════════════════
// ─── SELECCIÓN ARGENTINA ─────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════

const PALABRAS_SELECCION = [
  "seleccion argentina", "seleccion", "albiceleste", "argentina",
  "scaloni", "scaloneta", "messi", "leo messi", "lionel messi",
  "di maria", "dibu", "dibu martinez", "emiliano martinez",
  "lautaro", "lautaro martinez", "julian alvarez", "dybala",
  "de paul", "mac allister", "enzo fernandez", "paredes",
  "molina", "tagliafico", "otamendi", "cuti romero", "cristian romero",
  "lisandro martinez", "garnacho", "almada", "nico gonzalez",
  "mundial", "mundial 2026", "copa america", "eliminatorias",
  "afa", "campeon del mundo", "tricampeon"
];

// Para Selección descartamos noticias de clubes que distraen
const PALABRAS_NEGATIVAS_SEL = [
  "river plate", "millonario", "monumental",
  "boca juniors", "boca jr", "bocajuniors", "xeneize",
  "racing club", "independiente", "san lorenzo", "huracán",
  "formula 1", "formula uno", "nba", "nfl", "rugby", "tenis",
  "atletismo", "natacion", "boxeo", "ufc", "mma"
];

function esNoticiaDeSeleccion(titulo: string, url: string): boolean {
  const textoLower = titulo.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const urlLower = url.toLowerCase();

  for (const neg of PALABRAS_NEGATIVAS_SEL) {
    const negNorm = neg.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (textoLower.includes(negNorm)) return false;
  }

  if (
    urlLower.includes("/seleccion") ||
    urlLower.includes("seleccion-argentina") ||
    urlLower.includes("/argentina/") ||
    urlLower.includes("tag/seleccion") ||
    urlLower.includes("scaloneta")
  ) return true;

  return PALABRAS_SELECCION.some((p) =>
    textoLower.includes(p.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
  );
}

async function scrapearSitioSeleccion(
  url: string,
  baseUrl: string,
  fuente: string,
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

  const filtradas = todas.filter((n) => esNoticiaDeSeleccion(n.titulo, n.url));
  return (filtradas.length >= 2 ? filtradas : todas).slice(0, 10);
}

async function scrapearOleSeleccion(): Promise<NoticiaRaw[]> {
  return scrapearSitioSeleccion(
    "https://www.ole.com.ar/seleccion-argentina/",
    "https://www.ole.com.ar",
    "Olé Selección",
  );
}

async function scrapearTyCSeleccion(): Promise<NoticiaRaw[]> {
  return scrapearSitioSeleccion(
    "https://www.tycsports.com/seleccion-argentina",
    "https://www.tycsports.com",
    "TyC Sports Selección",
  );
}

async function scrapearGoogleNewsSeleccion(): Promise<NoticiaRaw[]> {
  const url = "https://news.google.com/rss/search?q=%22seleccion+argentina%22+OR+%22scaloni%22+OR+%22scaloneta%22+when:24h&hl=es-419&gl=AR&ceid=AR:es-419";
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "application/rss+xml, text/xml, */*" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Google News Selección respondió ${res.status}`);
  const xml = await res.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  const noticias: NoticiaRaw[] = [];
  $("item").each((_, el) => {
    const titulo = $(el).find("title").text().trim();
    const link = $(el).find("link").text().trim() || $(el).find("guid").text().trim();
    const fuente = $(el).find("source").text().trim() || "Google News";
    if (titulo && titulo.length > 20 && titulo.length < 250 && esNoticiaDeSeleccion(titulo, link)) {
      if (!noticias.find((n) => n.titulo === titulo)) {
        noticias.push({ titulo, url: link, fuente });
      }
    }
  });
  return noticias.slice(0, 12);
}

const FUENTES_SELECCION: Record<string, () => Promise<NoticiaRaw[]>> = {
  ole: scrapearOleSeleccion,
  tyc: scrapearTyCSeleccion,
  google: scrapearGoogleNewsSeleccion,
};

router.get("/noticias-seleccion", async (req, res) => {
  const fuente = (req.query.fuente as string) ?? "ole";
  try {
    let noticias: NoticiaRaw[];
    if (FUENTES_SELECCION[fuente]) {
      // Fuente con scraper dedicado de Selección (sección /seleccion-argentina)
      noticias = await FUENTES_SELECCION[fuente]();
    } else if (FUENTES[fuente]) {
      // Misma fuente que River, filtrando solo lo que es de la Selección
      const todas = await FUENTES[fuente]();
      noticias = todas.filter((n) => esNoticiaDeSeleccion(n.titulo, n.url));
    } else {
      noticias = await scrapearOleSeleccion();
    }
    if (noticias.length === 0) {
      res.status(404).json({ error: "No se encontraron noticias de la Selección." });
      return;
    }
    res.json({ noticias });
  } catch (err) {
    req.log.error({ err }, "Error scrapeando noticias selección");
    res.status(500).json({ error: "No se pudo conectar con la fuente de Selección" });
  }
});

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
