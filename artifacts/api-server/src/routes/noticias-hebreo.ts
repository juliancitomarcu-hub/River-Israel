import { Router, type IRouter } from "express";
import { db, noticiasTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { traducirYGuardarHebreo } from "../lib/traductor-hebreo";
import { requireAdmin } from "../middleware/requireAdmin";

const router: IRouter = Router();

router.use("/noticias-hebreo", requireAdmin);

router.get("/noticias-hebreo", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(noticiasTable)
      .where(eq(noticiasTable.publicada, true))
      .orderBy(desc(noticiasTable.createdAt));

    const noticias = rows.map(n => ({
      id: n.id,
      titulo: n.titulo,
      contenido: n.contenido,
      tags: n.tags,
      fuente: n.fuente,
      imagenPortada: n.imagenPortada ?? "",
      createdAt: n.createdAt,
      tituloHe: n.tituloHe ?? "",
      contenidoHe: n.contenidoHe ?? "",
      tagsHe: n.tagsHe ?? "",
      estaTraducida: !!(n.contenidoHe && n.contenidoHe.length > 100),
    }));

    res.set("Cache-Control", "no-store");
    res.json({ noticias, total: noticias.length });
  } catch (err) {
    req.log.error({ err }, "Error listando noticias hebreo");
    res.status(500).json({ error: "Error al cargar noticias" });
  }
});

router.post("/noticias-hebreo/:id/traducir", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  try {
    await traducirYGuardarHebreo(id, { force: true });
    const [actualizada] = await db.select().from(noticiasTable).where(eq(noticiasTable.id, id)).limit(1);
    if (!actualizada) { res.status(404).json({ error: "Noticia no encontrada" }); return; }
    res.json({
      ok: true,
      noticia: {
        id: actualizada.id,
        tituloHe: actualizada.tituloHe ?? "",
        contenidoHe: actualizada.contenidoHe ?? "",
        tagsHe: actualizada.tagsHe ?? "",
        estaTraducida: !!(actualizada.contenidoHe && actualizada.contenidoHe.length > 100),
      },
    });
  } catch (err) {
    req.log.error({ err, id }, "Error traduciendo noticia al hebreo");
    res.status(500).json({ error: "Error al traducir" });
  }
});

let traduciendoMasivo = false;

router.post("/noticias-hebreo/traducir-pendientes", async (req, res) => {
  if (traduciendoMasivo) {
    res.json({ ok: true, total: 0, mensaje: "Ya hay una traducción masiva en curso, esperá a que termine" });
    return;
  }
  try {
    const rows = await db
      .select({ id: noticiasTable.id, contenidoHe: noticiasTable.contenidoHe })
      .from(noticiasTable)
      .where(eq(noticiasTable.publicada, true));

    const pendientes = rows.filter(r => !r.contenidoHe || r.contenidoHe.length <= 100).map(r => r.id);

    res.json({ ok: true, total: pendientes.length, mensaje: `Traduciendo ${pendientes.length} noticias en segundo plano` });

    traduciendoMasivo = true;
    (async () => {
      try {
        for (const id of pendientes) {
          try {
            await traducirYGuardarHebreo(id, { force: true });
          } catch (err) {
            req.log.warn({ err, id }, "Falla traduciendo noticia pendiente");
          }
        }
      } finally {
        traduciendoMasivo = false;
      }
    })().catch(() => { traduciendoMasivo = false; });
  } catch (err) {
    req.log.error({ err }, "Error en traducir-pendientes");
    res.status(500).json({ error: "Error al iniciar traducción masiva" });
  }
});

export default router;
