import type { Request, Response } from "express";
import { db, noticiasTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const SITE_URL = (process.env.SITE_URL ?? "https://riverplateisrael.com").replace(/\/$/, "");

const STATIC_ROUTES: { path: string; priority: string; changefreq: string }[] = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/actualidad", priority: "0.9", changefreq: "daily" },
  { path: "/historia", priority: "0.7", changefreq: "monthly" },
  { path: "/equipo", priority: "0.7", changefreq: "weekly" },
  { path: "/filial-ramat-gan", priority: "0.6", changefreq: "monthly" },
];

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

export async function sitemapHandler(req: Request, res: Response): Promise<void> {
  try {
    const notas = await db
      .select({ id: noticiasTable.id, createdAt: noticiasTable.createdAt })
      .from(noticiasTable)
      .where(eq(noticiasTable.publicada, true))
      .orderBy(desc(noticiasTable.createdAt));

    const urls: string[] = [];

    for (const r of STATIC_ROUTES) {
      urls.push(
        `  <url>\n    <loc>${SITE_URL}${r.path}</loc>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`,
      );
    }

    for (const n of notas) {
      const fecha = n.createdAt instanceof Date ? n.createdAt : new Date(n.createdAt);
      const lastmod = fecha.toISOString().split("T")[0];
      urls.push(
        `  <url>\n    <loc>${escapeXml(`${SITE_URL}/noticia/${n.id}`)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
      );
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join(
      "\n",
    )}\n</urlset>\n`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (err) {
    req.log.error({ err }, "Error generando sitemap.xml");
    res.status(500).type("text/plain").send("Error generando sitemap");
  }
}
