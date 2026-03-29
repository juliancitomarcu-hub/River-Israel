import { Router, type IRouter } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { galeriaTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const storageService = new ObjectStorageService();

const FOTOS_INICIALES = [
  { url: "/images/galeria/foto-01.jpeg", caption: "Jugada millonaria", orden: 1 },
  { url: "/images/galeria/foto-02.jpeg", caption: "El Monumental iluminado", orden: 2 },
  { url: "/images/galeria/foto-03.jpeg", caption: "El festejo del gol", orden: 3 },
  { url: "/images/galeria/foto-04.jpeg", caption: "La hinchada millonaria", orden: 4 },
  { url: "/images/galeria/foto-05.jpeg", caption: "Entrenamiento", orden: 5 },
  { url: "/images/galeria/foto-06.jpeg", caption: "El plantel", orden: 6 },
  { url: "/images/galeria/foto-07.jpeg", caption: "El técnico dirige", orden: 7 },
  { url: "/images/galeria/foto-08.jpeg", caption: "El Muñeco", orden: 8 },
  { url: "/images/galeria/foto-09.jpeg", caption: "Colección millonaria", orden: 9 },
  { url: "/images/galeria/foto-10.jpeg", caption: "La tienda del club", orden: 10 },
  { url: "/images/galeria/foto-11.jpeg", caption: "Banderas en el Monumental", orden: 11 },
  { url: "/images/galeria/foto-12.jpeg", caption: "El DT del Millo", orden: 12 },
];

async function seedGaleriaIfEmpty() {
  try {
    const existing = await db.select().from(galeriaTable).limit(1);
    if (existing.length === 0) {
      await db.insert(galeriaTable).values(FOTOS_INICIALES);
    }
  } catch {
    // tabla aún no existe — se creará con la migración
  }
}

router.get("/galeria", async (req, res) => {
  try {
    await seedGaleriaIfEmpty();
    const fotos = await db.select().from(galeriaTable).orderBy(asc(galeriaTable.orden));
    res.json({ fotos });
  } catch (err) {
    req.log.error({ err }, "Error listando galería");
    res.status(500).json({ error: "Error al cargar la galería" });
  }
});

router.post("/galeria", upload.single("foto"), async (req, res) => {
  try {
    const caption = (req.body as { caption?: string }).caption ?? "";
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Falta la foto" });
      return;
    }
    const ext = file.originalname.split(".").pop()?.toLowerCase() ?? "jpg";
    const subPath = `galeria/${Date.now()}.${ext}`;
    const objectPath = await storageService.uploadBuffer(subPath, file.buffer, file.mimetype ?? "image/jpeg");
    const existentes = await db.select({ orden: galeriaTable.orden }).from(galeriaTable).orderBy(asc(galeriaTable.orden));
    const nextOrden = (existentes[existentes.length - 1]?.orden ?? 0) + 1;
    const [foto] = await db.insert(galeriaTable).values({ url: objectPath, caption, orden: nextOrden }).returning();
    res.json({ ok: true, foto });
  } catch (err) {
    req.log.error({ err }, "Error subiendo foto");
    res.status(500).json({ error: "Error al subir la foto" });
  }
});

router.put("/galeria/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { caption } = req.body as { caption?: string };
  if (!caption && caption !== "") {
    res.status(400).json({ error: "Falta el caption" });
    return;
  }
  try {
    const [foto] = await db.update(galeriaTable).set({ caption: caption ?? "" }).where(eq(galeriaTable.id, id)).returning();
    res.json({ ok: true, foto });
  } catch (err) {
    req.log.error({ err }, "Error editando foto");
    res.status(500).json({ error: "Error al editar la foto" });
  }
});

router.delete("/galeria/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await db.delete(galeriaTable).where(eq(galeriaTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error eliminando foto");
    res.status(500).json({ error: "Error al eliminar la foto" });
  }
});

export default router;
