import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, comentariosTable, noticiasTable } from "@workspace/db";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

const MAX_AUTOR = 60;
const MAX_CONTENIDO = 1000;

// Público: listar comentarios visibles de una noticia publicada.
router.get("/noticias/:id/comentarios", async (req, res) => {
  const noticiaId = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(noticiaId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  try {
    const [noticia] = await db
      .select({ id: noticiasTable.id, publicada: noticiasTable.publicada })
      .from(noticiasTable)
      .where(eq(noticiasTable.id, noticiaId))
      .limit(1);
    if (!noticia || !noticia.publicada) {
      res.status(404).json({ error: "Noticia no encontrada" });
      return;
    }
    const comentarios = await db
      .select({
        id: comentariosTable.id,
        autor: comentariosTable.autor,
        contenido: comentariosTable.contenido,
        createdAt: comentariosTable.createdAt,
      })
      .from(comentariosTable)
      .where(and(eq(comentariosTable.noticiaId, noticiaId), eq(comentariosTable.oculto, false)))
      .orderBy(desc(comentariosTable.createdAt));
    res.json({ comentarios });
  } catch (err) {
    req.log.error({ err }, "Error listando comentarios");
    res.status(500).json({ error: "Error al cargar comentarios" });
  }
});

// Público: crear un comentario en una noticia publicada.
router.post("/noticias/:id/comentarios", async (req, res) => {
  const noticiaId = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(noticiaId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const { autor, contenido } = req.body as { autor?: string; contenido?: string };
  if (!contenido?.trim()) {
    res.status(400).json({ error: "El comentario no puede estar vacío" });
    return;
  }
  try {
    const [noticia] = await db
      .select({ id: noticiasTable.id, publicada: noticiasTable.publicada })
      .from(noticiasTable)
      .where(eq(noticiasTable.id, noticiaId))
      .limit(1);
    if (!noticia || !noticia.publicada) {
      res.status(404).json({ error: "Noticia no encontrada" });
      return;
    }
    const [comentario] = await db
      .insert(comentariosTable)
      .values({
        noticiaId,
        autor: (autor?.trim() || "Anónimo").slice(0, MAX_AUTOR),
        contenido: contenido.trim().slice(0, MAX_CONTENIDO),
      })
      .returning({
        id: comentariosTable.id,
        autor: comentariosTable.autor,
        contenido: comentariosTable.contenido,
        createdAt: comentariosTable.createdAt,
      });
    res.status(201).json({ comentario });
  } catch (err) {
    req.log.error({ err }, "Error creando comentario");
    res.status(500).json({ error: "Error al publicar el comentario" });
  }
});

// Admin: listar todos los comentarios (con título de la noticia) para moderar.
router.get("/comentarios", requireAdmin, async (req, res) => {
  try {
    const comentarios = await db
      .select({
        id: comentariosTable.id,
        noticiaId: comentariosTable.noticiaId,
        autor: comentariosTable.autor,
        contenido: comentariosTable.contenido,
        oculto: comentariosTable.oculto,
        createdAt: comentariosTable.createdAt,
        noticiaTitulo: noticiasTable.titulo,
      })
      .from(comentariosTable)
      .leftJoin(noticiasTable, eq(comentariosTable.noticiaId, noticiasTable.id))
      .orderBy(desc(comentariosTable.createdAt));
    res.json({ comentarios });
  } catch (err) {
    req.log.error({ err }, "Error listando comentarios (admin)");
    res.status(500).json({ error: "Error al cargar comentarios" });
  }
});

// Admin: eliminar un comentario.
router.delete("/comentarios/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  try {
    await db.delete(comentariosTable).where(eq(comentariosTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error eliminando comentario");
    res.status(500).json({ error: "Error al eliminar el comentario" });
  }
});

export default router;
