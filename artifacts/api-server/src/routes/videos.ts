import { Router, type IRouter } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { videosTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { ObjectStorageService } from "../lib/objectStorage";
import { requireAdmin } from "../middleware/requireAdmin";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
const storageService = new ObjectStorageService();

const VIDEOS_INICIALES = [
  { url: "/videos/video-01.mp4", titulo: "Gol del Millo", orden: 1 },
  { url: "/videos/video-02.mov", titulo: "Momento millonario", orden: 2 },
  { url: "/videos/video-03.mp4", titulo: "La filial en acción", orden: 3 },
];

async function seedVideosIfEmpty() {
  try {
    const existing = await db.select().from(videosTable).limit(1);
    if (existing.length === 0) {
      await db.insert(videosTable).values(VIDEOS_INICIALES);
    }
  } catch {
    // tabla aún no existe — se creará con la migración
  }
}

router.get("/videos", async (req, res) => {
  try {
    await seedVideosIfEmpty();
    const videos = await db.select().from(videosTable).orderBy(asc(videosTable.orden));
    res.set("Cache-Control", "no-store, no-cache").json({ videos });
  } catch (err) {
    req.log.error({ err }, "Error listando videos");
    res.status(500).json({ error: "Error al cargar los videos" });
  }
});

router.post("/videos", requireAdmin, upload.single("video"), async (req, res) => {
  try {
    const titulo = (req.body as { titulo?: string }).titulo ?? "";
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Falta el video" });
      return;
    }
    const ext = file.originalname.split(".").pop()?.toLowerCase() ?? "mp4";
    const subPath = `videos/${Date.now()}.${ext}`;
    const objectPath = await storageService.uploadBuffer(subPath, file.buffer, file.mimetype ?? "video/mp4");
    const existentes = await db.select({ orden: videosTable.orden }).from(videosTable).orderBy(asc(videosTable.orden));
    const nextOrden = (existentes[existentes.length - 1]?.orden ?? 0) + 1;
    const [video] = await db.insert(videosTable).values({ url: objectPath, titulo, orden: nextOrden }).returning();
    res.json({ ok: true, video });
  } catch (err) {
    req.log.error({ err }, "Error subiendo video");
    res.status(500).json({ error: "Error al subir el video" });
  }
});

router.put("/videos/:id", requireAdmin, upload.single("thumbnail"), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const titulo = (req.body as { titulo?: string }).titulo;
    const updateData: Record<string, unknown> = {};
    if (titulo !== undefined) updateData.titulo = titulo;
    if (req.file) {
      const ext = req.file.originalname.split(".").pop()?.toLowerCase() ?? "jpg";
      const subPath = `videos/thumbs/${Date.now()}.${ext}`;
      const thumbPath = await storageService.uploadBuffer(subPath, req.file.buffer, req.file.mimetype ?? "image/jpeg");
      updateData.thumbnail = thumbPath;
    }
    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }
    const [video] = await db.update(videosTable).set(updateData).where(eq(videosTable.id, id)).returning();
    res.json({ ok: true, video });
  } catch (err) {
    req.log.error({ err }, "Error editando video");
    res.status(500).json({ error: "Error al editar el video" });
  }
});

router.delete("/videos/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    await db.delete(videosTable).where(eq(videosTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error eliminando video");
    res.status(500).json({ error: "Error al eliminar el video" });
  }
});

export default router;
