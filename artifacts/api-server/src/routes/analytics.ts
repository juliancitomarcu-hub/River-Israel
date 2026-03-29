import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

let cache: { data: unknown; fetchedAt: number } | null = null;
const CACHE_MS = 12 * 60 * 60 * 1000;

router.get("/analytics", async (req, res) => {
  try {
    const ahora = Date.now();
    const force = req.query.force === "1";

    if (cache && !force && ahora - cache.fetchedAt < CACHE_MS) {
      return res.json({ ...cache.data, fromCache: true, fetchedAt: cache.fetchedAt });
    }

    const totalesRes = await db.execute(sql`
      SELECT
        COUNT(*)                                                              AS total,
        COUNT(*) FILTER (WHERE publicada = true)                             AS publicadas,
        COUNT(*) FILTER (WHERE pendiente = true)                             AS pendientes,
        COUNT(*) FILTER (WHERE publicada = false AND pendiente = false)      AS rechazadas
      FROM noticias
    `);

    const fuentesRes = await db.execute(sql`
      SELECT fuente, COUNT(*) AS cantidad
      FROM noticias
      WHERE publicada = true
      GROUP BY fuente
      ORDER BY cantidad DESC
    `);

    const galeriaRes = await db.execute(sql`SELECT COUNT(*) AS fotos FROM galeria`);
    const videosRes  = await db.execute(sql`SELECT COUNT(*) AS videos FROM videos_galeria`);

    const ultimasRes = await db.execute(sql`
      SELECT titulo, fuente, created_at
      FROM noticias
      WHERE publicada = true
      ORDER BY created_at DESC
      LIMIT 10
    `);

    const porMesRes = await db.execute(sql`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') AS mes,
        COUNT(*)                        AS cantidad
      FROM noticias
      WHERE publicada = true
      GROUP BY mes
      ORDER BY mes DESC
      LIMIT 6
    `);

    const t = totalesRes.rows[0] as Record<string, string>;
    const g = galeriaRes.rows[0] as Record<string, string>;
    const v = videosRes.rows[0] as Record<string, string>;

    const data = {
      noticias: {
        total:      Number(t.total),
        publicadas: Number(t.publicadas),
        pendientes: Number(t.pendientes),
        rechazadas: Number(t.rechazadas),
      },
      fuentes: (fuentesRes.rows as Array<Record<string, string>>).map(f => ({
        fuente:   f.fuente,
        cantidad: Number(f.cantidad),
      })),
      galeria: { fotos:  Number(g.fotos) },
      videos:  { total:  Number(v.videos) },
      ultimas: (ultimasRes.rows as Array<Record<string, string>>).map(n => ({
        titulo: n.titulo,
        fuente: n.fuente,
        fecha:  n.created_at,
      })),
      porMes: (porMesRes.rows as Array<Record<string, string>>).map(m => ({
        mes:      m.mes,
        cantidad: Number(m.cantidad),
      })),
      fromCache:  false,
      fetchedAt:  ahora,
    };

    cache = { data, fetchedAt: ahora };
    return res.json(data);
  } catch (err) {
    console.error("[analytics]", err);
    return res.status(500).json({ error: "Error al obtener analytics" });
  }
});

export default router;
