import { Router, type IRouter } from "express";
import * as cheerio from "cheerio";

const router: IRouter = Router();

interface NoticiaRaw {
  titulo: string;
  url: string;
  fuente: string;
}

async function scrapearTyC(): Promise<NoticiaRaw[]> {
  const res = await fetch("https://www.tycsports.com/river-plate", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-AR,es;q=0.9",
    },
  });

  if (!res.ok) throw new Error(`TyC respondió ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const noticias: NoticiaRaw[] = [];

  $("h2, h3, h4").each((_, el) => {
    const texto = $(el).text().trim();
    if (texto.length < 15) return;

    const link = $(el).find("a").attr("href") ?? $(el).closest("a").attr("href") ?? "";
    const url = link.startsWith("http") ? link : link ? `https://www.tycsports.com${link}` : "";

    if (!noticias.find((n) => n.titulo === texto)) {
      noticias.push({ titulo: texto, url, fuente: "TyC Sports" });
    }
  });

  return noticias.slice(0, 6);
}

async function scrapearOle(): Promise<NoticiaRaw[]> {
  const res = await fetch("https://www.ole.com.ar/river-plate/", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-AR,es;q=0.9",
    },
  });

  if (!res.ok) throw new Error(`Olé respondió ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const noticias: NoticiaRaw[] = [];

  $("h2, h3, h4").each((_, el) => {
    const texto = $(el).text().trim();
    if (texto.length < 15) return;

    const link = $(el).find("a").attr("href") ?? $(el).closest("a").attr("href") ?? "";
    const url = link.startsWith("http") ? link : link ? `https://www.ole.com.ar${link}` : "";

    if (!noticias.find((n) => n.titulo === texto)) {
      noticias.push({ titulo: texto, url, fuente: "Olé" });
    }
  });

  return noticias.slice(0, 6);
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
