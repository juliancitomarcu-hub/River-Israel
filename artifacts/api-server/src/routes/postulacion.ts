import { Router, type IRouter } from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { ai } from "@workspace/integrations-gemini-ai";
import { db } from "@workspace/db";
import { noticiasTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../middleware/requireAdmin";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Solo se aceptan archivos PDF o Word (.docx/.doc)"));
    }
  },
});

const PROMPT_EDITOR_RESPETUOSO = `Actuás como corrector de estilo para "River en Israel". Tu función es TÉCNICA, NO creativa.

REGLAS ESTRICTAS:
- Corregí únicamente errores de ortografía, puntuación y tildes.
- Adaptá el texto a párrafos limpios para la web, manteniendo los títulos originales si los hay.
- PROHIBIDO modificar el vocabulario, las opiniones ni el estilo del autor. Si el autor usa modismos, expresiones pasionales o lenguaje de hinchada, mantenelos INTACTOS.
- Si el texto menciona horarios de partidos, asegurate de que esté clara la referencia a Israel.
- No agregues frases de cierre, publicidad ni llamados a la acción.
- No agregues comentarios ni explicaciones sobre tus correcciones.

FORMATO DE SALIDA:
Devolvé únicamente el texto corregido, listo para publicar. Sin comentarios previos ni explicaciones.`;

async function extraerTextoDeArchivo(buffer: Buffer, mimetype: string): Promise<string> {
  if (mimetype === "application/pdf") {
    const data = await pdfParse(buffer);
    return data.text.trim();
  }
  // DOCX o DOC
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

router.post("/postular-redactor", upload.single("archivo"), async (req, res) => {
  const { nombre, ciudad, tipo, texto, link } = req.body as {
    nombre?: string;
    ciudad?: string;
    tipo?: string;
    texto?: string;
    link?: string;
  };

  if (!nombre?.trim() || !ciudad?.trim() || !tipo?.trim()) {
    res.status(400).json({ error: "Faltan campos obligatorios (nombre, ciudad, tipo)" });
    return;
  }

  const tieneTexto = texto?.trim() && texto.trim().length >= 50;
  const tieneArchivo = !!req.file;

  if (!tieneTexto && !tieneArchivo) {
    res.status(400).json({ error: "Incluí tu nota como texto (mínimo 50 caracteres) o adjuntá un archivo PDF/Word" });
    return;
  }

  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    res.status(503).json({ error: "Sistema no disponible temporalmente" });
    return;
  }

  try {
    // Extraer texto del archivo si fue adjuntado
    let textoArchivo = "";
    if (tieneArchivo && req.file) {
      try {
        textoArchivo = await extraerTextoDeArchivo(req.file.buffer, req.file.mimetype);
      } catch {
        res.status(422).json({ error: "No se pudo leer el archivo. Verificá que sea un PDF o Word válido." });
        return;
      }
    }

    // Combinar: texto del textarea + texto del archivo
    const textoRaw = [texto?.trim(), textoArchivo].filter(Boolean).join("\n\n");

    if (textoRaw.length < 50) {
      res.status(400).json({ error: "El contenido es demasiado corto (mínimo 50 caracteres)" });
      return;
    }

    // Corrección con IA (con fallback: si falla, se usa el texto original)
    let textoCorregido = textoRaw;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: `Corregí este texto de ${nombre} (${ciudad}), sin cambiar su voz:\n\n${textoRaw}` }] }],
        config: {
          systemInstruction: PROMPT_EDITOR_RESPETUOSO,
          maxOutputTokens: 4096,
        },
      });
      textoCorregido = response.text?.trim() ?? textoRaw;
    } catch (aiErr) {
      req.log.warn({ err: aiErr }, "Postulación: fallo IA, usando texto original");
    }

    // Guardar en DB
    const titulo = `✍️ ${nombre} (${ciudad})`;
    const contenidoCompleto = `*Por ${nombre}, desde ${ciudad}*\n\n${textoCorregido}`;
    const fuentePartes = [`Postulación`, tipo];
    if (tieneArchivo && req.file) fuentePartes.push(`📎 ${req.file.originalname}`);
    if (link) fuentePartes.push(link);
    const fuenteInfo = fuentePartes.join(" · ");

    const [postulacion] = await db
      .insert(noticiasTable)
      .values({
        titulo,
        contenido: contenidoCompleto,
        tags: `#Postulacion #${tipo.replace(/\s+/g, "")} #RiverIsrael`,
        textoOriginal: textoRaw,
        fuente: fuenteInfo,
        publicada: false,
        pendiente: true,
        imagenPortada: "",
      })
      .returning();

    // Mensaje Telegram
    const tipoEmoji = tipo === "Periodista" ? "🎙️" : tipo === "Creador" ? "🎬" : "❤️";
    const textoTg = textoCorregido.slice(0, 900) + (textoCorregido.length > 900 ? "..." : "");

    let mensajeTg =
      `🔴 *NUEVA POSTULACIÓN DE REDACTOR*\n\n` +
      `${tipoEmoji} *${tipo}*\n` +
      `👤 *Autor:* ${nombre}\n` +
      `📍 *Ciudad:* ${ciudad}\n`;

    if (tieneArchivo && req.file) {
      mensajeTg += `📎 *Archivo:* ${req.file.originalname}\n`;
    }
    if (link) {
      mensajeTg += `🔗 *Link:* ${link}\n`;
    }

    mensajeTg += `\n${textoTg}\n\n_¿Publicamos esta nota con la firma del autor?_`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: "✅ Publicar con su firma", callback_data: `publicar_${postulacion.id}` },
          { text: "❌ Rechazar", callback_data: `rechazar_${postulacion.id}` },
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
        .where(eq(noticiasTable.id, postulacion.id));
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error procesando postulación");
    res.status(500).json({ error: "Error al procesar la postulación. Intentá de nuevo más tarde." });
  }
});

router.get("/postulaciones", requireAdmin, async (req, res) => {
  try {
    const all = await db
      .select()
      .from(noticiasTable)
      .orderBy(desc(noticiasTable.id));
    const postulaciones = all.filter((n) => n.fuente.startsWith("Postulación"));
    res.json({ postulaciones });
  } catch (err) {
    req.log.error({ err }, "Error fetching postulaciones");
    res.status(500).json({ error: "Error al cargar postulaciones" });
  }
});

router.post("/postulaciones/:id/rechazar", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  try {
    await db.update(noticiasTable).set({ pendiente: false, publicada: false }).where(eq(noticiasTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error rechazando postulación");
    res.status(500).json({ error: "Error al rechazar" });
  }
});

export default router;
