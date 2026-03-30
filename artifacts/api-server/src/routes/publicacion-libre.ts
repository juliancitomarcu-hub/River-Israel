import { Router, type IRouter } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { noticiasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ObjectStorageService } from "../lib/objectStorage";

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

router.post("/publicacion-libre", upload.single("imagen"), async (req, res) => {
  const { titulo, contenido } = req.body as { titulo?: string; contenido?: string };

  if (!titulo?.trim() || titulo.trim().length < 3) {
    res.status(400).json({ error: "El título es obligatorio (mínimo 3 caracteres)" });
    return;
  }
  if (!contenido?.trim() || contenido.trim().length < 20) {
    res.status(400).json({ error: "El contenido es obligatorio (mínimo 20 caracteres)" });
    return;
  }

  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    res.status(503).json({ error: "Sistema no disponible temporalmente" });
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

    // Guardar en DB como pendiente
    const [publicacion] = await db
      .insert(noticiasTable)
      .values({
        titulo: titulo.trim(),
        contenido: contenido.trim(),
        tags: "#RiverEnIsrael #PublicacionLibre",
        textoOriginal: contenido.trim(),
        fuente: "Publicación Libre",
        publicada: false,
        pendiente: true,
        imagenPortada,
      })
      .returning();

    // Enviar a Telegram para aprobación
    const preview = contenido.trim().slice(0, 800) + (contenido.trim().length > 800 ? "..." : "");
    const mensajeTg =
      `✍️ *PUBLICACIÓN LIBRE*\n\n` +
      `*${titulo.trim()}*\n\n` +
      `${preview}\n\n` +
      `${imagenPortada ? "📷 _Incluye imagen de portada_\n\n" : ""}` +
      `_¿Publicamos esta nota?_`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: "✅ Publicar", callback_data: `publicar_${publicacion.id}` },
          { text: "❌ Rechazar", callback_data: `rechazar_${publicacion.id}` },
        ],
      ],
    };

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: mensajeTg,
        parse_mode: "Markdown",
        reply_markup: replyMarkup,
      }),
    });

    const tgData = await tgRes.json() as { ok: boolean; result?: { message_id: number } };
    if (tgData.ok && tgData.result?.message_id) {
      await db
        .update(noticiasTable)
        .set({ telegramMessageId: String(tgData.result.message_id) })
        .where(eq(noticiasTable.id, publicacion.id));
    }

    res.json({ ok: true, id: publicacion.id });
  } catch (err) {
    req.log.error({ err }, "Error procesando publicación libre");
    res.status(500).json({ error: "Error al enviar la publicación. Intentá de nuevo." });
  }
});

export default router;
