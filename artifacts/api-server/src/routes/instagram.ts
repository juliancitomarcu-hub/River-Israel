import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAdmin } from "../middleware/requireAdmin";
import { cuentaInstagram } from "../lib/instagram-core";

const router = Router();
router.get("/instagram/publicaciones", requireAdmin, async (_req, res) => {
  try {
    const cuenta = cuentaInstagram("river");
    const result = await pool.query(`SELECT j.noticia_id, n.titulo, j.estado, j.caption, j.imagen_url,
      j.media_id, j.error, j.intentos, j.created_at FROM instagram_publicaciones j
      JOIN noticias n ON n.id = j.noticia_id WHERE j.categoria = 'river'
      ORDER BY j.created_at DESC LIMIT 50`);
    res.json({ cuenta: "@riverplateisrael", configurada: !!cuenta, desde: cuenta?.desde ?? null, publicaciones: result.rows });
  } catch { res.status(503).json({ error: "Instagram no está listo: comprobar la migración de base de datos" }); }
});
router.post("/instagram/publicaciones/:id/reintentar", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) { res.status(400).json({ error: "ID inválido" }); return; }
  try {
    const result = await pool.query(`UPDATE instagram_publicaciones SET
      estado = CASE WHEN container_id IS NULL THEN 'pendiente' ELSE 'preparada' END,
      intentos = 0, error = NULL, next_attempt_at = now(), updated_at = now()
      WHERE noticia_id = $1 AND categoria = 'river' AND estado = 'fallida' AND media_id IS NULL
      AND EXISTS (SELECT 1 FROM noticias WHERE id = $1 AND publicada AND categoria = 'river')
      RETURNING noticia_id`, [id]);
    if (!result.rowCount) { res.status(409).json({ error: "Solo se pueden reintentar fallos previos a publicar; las respuestas inciertas requieren revisión" }); return; }
    res.json({ ok: true });
  } catch { res.status(503).json({ error: "No se pudo reintentar la entrega" }); }
});
export default router;
