import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { noticiasTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

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

router.post("/postular-redactor", async (req, res) => {
  const { nombre, ciudad, tipo, texto, link } = req.body as {
    nombre?: string;
    ciudad?: string;
    tipo?: string;
    texto?: string;
    link?: string;
  };

  if (!nombre?.trim() || !ciudad?.trim() || !tipo?.trim() || !texto?.trim()) {
    res.status(400).json({ error: "Faltan campos obligatorios" });
    return;
  }

  if (texto.trim().length < 50) {
    res.status(400).json({ error: "El texto es demasiado corto (mínimo 50 caracteres)" });
    return;
  }

  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    res.status(503).json({ error: "Sistema no disponible temporalmente" });
    return;
  }

  try {
    // Proceso el texto con la IA en modo corrector respetuoso
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: PROMPT_EDITOR_RESPETUOSO },
        {
          role: "user",
          content: `Corregí este texto de ${nombre} (${ciudad}), sin cambiar su voz:\n\n${texto}`
        }
      ],
    });

    const textoCorregido = completion.choices[0]?.message?.content?.trim() ?? texto;

    // Guardo la postulación en la DB (marcada como pendiente, tipo postulacion)
    const titulo = `✍️ ${nombre} (${ciudad})`;
    const contenidoCompleto = `*Por ${nombre}, desde ${ciudad}*\n\n${textoCorregido}`;
    const fuenteInfo = link ? `Postulación · ${tipo} · ${link}` : `Postulación · ${tipo}`;

    const [postulacion] = await db
      .insert(noticiasTable)
      .values({
        titulo,
        contenido: contenidoCompleto,
        tags: `#Postulacion #${tipo.replace(/\s+/g, "")} #RiverIsrael`,
        textoOriginal: texto,
        fuente: fuenteInfo,
        publicada: false,
        pendiente: true,
        imagenPortada: "",
      })
      .returning();

    // Armo el mensaje de Telegram
    const tipoEmoji = tipo === "Periodista" ? "🎙️" : tipo === "Creador" ? "🎬" : "❤️";
    const textoTg = textoCorregido.slice(0, 900) + (textoCorregido.length > 900 ? "..." : "");

    let mensajeTg =
      `🔴 *NUEVA POSTULACIÓN DE REDACTOR*\n\n` +
      `${tipoEmoji} *${tipo}*\n` +
      `👤 *Autor:* ${nombre}\n` +
      `📍 *Ciudad:* ${ciudad}\n`;

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

export default router;
