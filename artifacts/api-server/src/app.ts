import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { sitemapHandler } from "./sitemap";
import { ogImageNoticiaHandler, ogNoticiaHandler } from "./og-noticia";
import { logger } from "./lib/logger";
import path from "node:path";
import { existsSync } from "node:fs";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/sitemap.xml", sitemapHandler);
// Open Graph dinámico por nota (el proxy enruta /noticia/* a este servidor)
app.get("/noticia/:id", ogNoticiaHandler);
// Imagen social normalizada a 1200x630; va bajo /api para conservar el
// prefijo del servicio API ya publicado en artifact.toml.
app.get("/api/og-image/noticia/:id", ogImageNoticiaHandler);

app.use("/api", router);

// A standalone deployment serves the built SPA and API from the same origin.
// Replit's existing routing stays in place when STATIC_DIR is absent.
if (process.env.STATIC_DIR) {
  const staticDir = path.resolve(process.env.STATIC_DIR);
  const indexFile = path.join(staticDir, "index.html");
  if (!existsSync(indexFile)) throw new Error(`Missing frontend build: ${indexFile}`);
  app.use(express.static(staticDir, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/") || req.path === "/api" || !req.accepts("html")) return next();
    res.sendFile(indexFile);
  });
}

export default app;
