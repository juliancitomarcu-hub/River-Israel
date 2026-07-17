import { Router, type IRouter } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { noticiasTable } from "@workspace/db";
import { ObjectStorageService } from "../lib/objectStorage";
import { requireAdmin } from "../middleware/requireAdmin";
import { notificarNotaPublicada } from "../lib/notificar-publicacion";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se aceptan imágenes"));
    }
  },
});

router.post("/publicacion-libre", requireAdmin, upload.single("imagen"), async (req, res) => {
  const { titulo, contenido, categoria: categoriaRaw } = req.body as { titulo?: string; contenido?: string; categoria?: string };
  const categoria = categoriaRaw === "seleccion" ? "seleccion" : "river";
  const esSel = categoria === "seleccion";

  if (!titulo?.trim() || titulo.trim().length < 3) {
    res.status(400).json({ error: "El título es obligatorio (mínimo 3 caracteres)" });
    return;
  }
  if (!contenido?.trim() || contenido.trim().length < 20) {
    res.status(400).json({ error: "El contenido es obligatorio (mínimo 20 caracteres)" });
    return;
  }

  try {
    // Subir imagen si hay
    let imagenPortada = "";
    if (req.file) {
      try {
        const uploadURL = await objectStorageService.getObjectEntityUploadURL();
        const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
        await fetch(uploadURL, {
          method: "PUT",
          body: req.file.buffer,
          headers: { "Content-Type": req.file.mimetype },
        });
        imagenPortada = objectPath;
      } catch (imgErr) {
        req.log.warn({ err: imgErr }, "Publicación libre: error subiendo imagen, se continúa sin foto");
      }
    }

    // Guardar en DB directamente como publicada
    const [notaGuardada] = await db
      .insert(noticiasTable)
      .values({
        titulo: titulo.trim(),
        contenido: contenido.trim(),
        tags: esSel ? "#SeleccionArgentina #PublicacionLibre" : "#RiverEnIsrael #PublicacionLibre",
        textoOriginal: contenido.trim(),
        fuente: esSel ? "Publicación Libre Selección" : "Publicación Libre",
        publicada: true,
        pendiente: false,
        imagenPortada,
        categoria,
      })
      .returning();

    // 📣 Aviso de Telegram (fire-and-forget) — usa el bot de la categoría
    // correspondiente (River o Selección) y linkea directo a la nota.
    notificarNotaPublicada(notaGuardada);

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error procesando publicación libre");
    res.status(500).json({ error: "Error al publicar. Intentá de nuevo." });
  }
});

export default router;
