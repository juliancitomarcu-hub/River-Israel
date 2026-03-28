import { Router, type IRouter } from "express";
import * as cheerio from "cheerio";

const router: IRouter = Router();

interface NoticiaRaw {
  titulo: string;
  url: string;
  fuente: string;
}

const PALABRAS_RIVER = [
  "river", "millonario", "millo", "coudet", "bandito", "monumental",
  "gallardo", "muñeco", "núñez", "banda", "colidio", "borja", "ramirez",
  "tobias", "nacho", "libertadores", "filial", "superclasico", "clasico"
];

function esNoticiaDeRiver(titulo: string, url: string): boolean {
  const textoLower = titulo.toLowerCase();
  const urlLower = url.toLowerCase();
  if (urlLower.includes("/river-plate") || urlLower.includes("/river_plate")) return true;
  return PALABRAS_RIVER.some((p) => textoLower.includes(p));
}

async function scrapearSitio(
  url: string,
  baseUrl: string,
  fuente: string
): Promise<NoticiaRaw[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-AR,es;q=0.9",
    },
  });

  if (!res.ok) throw new Error(`${fuente} respondió ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const todas: NoticiaRaw[] = [];

  $("h1, h2, h3, h4").each((_, el) => {
    const texto = $(el).text().trim();
    if (texto.length < 20 || texto.length > 200) return;

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
  return (deRiver.length >= 3 ? deRiver : todas).slice(0, 6);
}

async function scrapearTyC(): Promise<NoticiaRaw[]> {
  return scrapearSitio(
    "https://www.tycsports.com/river-plate",
    "https://www.tycsports.com",
    "TyC Sports"
  );
}

async function scrapearOle(): Promise<NoticiaRaw[]> {
  return scrapearSitio(
    "https://www.ole.com.ar/river-plate/",
    "https://www.ole.com.ar",
    "Olé"
  );
}

router.get("/noticias-river", async (req, res) => {
  const fuente = (req.query.fuente as string) ?? "tyc";

  try {
    let noticias: NoticiaRaw[];

    if (fuente === "ole") {
      noticias = await scrapearOle();
    } else {
      noticias = await scrapearTyC();
    }

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
