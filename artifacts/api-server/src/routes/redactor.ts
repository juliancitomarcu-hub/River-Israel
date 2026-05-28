import { Router, type IRouter } from "express";
import { ai } from "@workspace/integrations-gemini-ai";
import { db } from "@workspace/db";
import { noticiasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { PROMPT_MAESTRO } from "../lib/prompt-maestro";
import { PROMPT_MAESTRO_SELECCION } from "../lib/prompt-maestro-seleccion";
import { requireAdmin } from "../middleware/requireAdmin";
import { generarImagenIG, type CategoriaImagen } from "../lib/generar-imagen-ig";

function elegirPrompt(categoria: CategoriaImagen): string {
  return categoria === "seleccion" ? PROMPT_MAESTRO_SELECCION : PROMPT_MAESTRO;
}

const router: IRouter = Router();

router.use("/procesar-noticia", requireAdmin);
router.use("/enviar-telegram", requireAdmin);
router.use("/test-scheduler", requireAdmin);

function parsearResultado(texto: string): { titulo: string; contenido: string; tags: string } {
  const tituloMatch = texto.match(/\*\*Título:\*\*\s*(.+)/);
  const bajadaMatch = texto.match(/\*\*Bajada:\*\*\s*(.+)/);
  const tagsMatch   = texto.match(/\*\*Tags:\*\*\s*(.+)/);

  const titulo = tituloMatch?.[1]?.trim() ?? "Sin título";
  const bajada = bajadaMatch?.[1]?.trim() ?? "";
  const tags   = tagsMatch?.[1]?.trim() ?? "#RiverPlate #RiverIsrael #RamatGan #AnalisisMillonario";

  let contenido = texto
    .replace(/\*\*Título:\*\*\s*.+\n?/, "")
    .replace(/\*\*Bajada:\*\*\s*.+\n?/, "")
    .replace(/\*\*Contenido:\*\*\s*\n?/, "")
    .replace(/\*\*Tags:\*\*\s*.+\n?/, "")
    .trim();

  if (bajada) {
    contenido = `*${bajada}*\n\n${contenido}`;
  }

  return { titulo, contenido, tags };
}

router.post("/procesar-noticia", async (req, res) => {
  const { texto, categoria } = req.body as { texto?: string; categoria?: CategoriaImagen };
  const categoriaFinal: CategoriaImagen = categoria === "seleccion" ? "seleccion" : "river";

  if (!texto || texto.trim().length < 10) {
    res.status(400).json({ error: "Falta el texto de la noticia" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const intro = categoriaFinal === "seleccion"
      ? "Transformá esta noticia para el sitio La Scaloneta en Israel (Selección Argentina, Mundial 2026):"
      : "Transformá esta noticia para el sitio River en Israel:";
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: `${intro}\n\n${texto}` }] }],
      config: {
        systemInstruction: elegirPrompt(categoriaFinal),
        maxOutputTokens: 8192,
      },
    });

    for await (const chunk of stream) {
      const content = chunk.text;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Error procesando noticia con IA");
    res.write(`data: ${JSON.stringify({ error: "Error al procesar la noticia" })}\n\n`);
    res.end();
  }
});

router.post("/enviar-telegram", async (req, res) => {
  const { texto, textoOriginal, fuente, imagenPortada, categoria } = req.body as {
    texto?: string;
    textoOriginal?: string;
    fuente?: string;
    imagenPortada?: string;
    categoria?: CategoriaImagen;
  };
  const categoriaFinal: CategoriaImagen = categoria === "seleccion" ? "seleccion" : "river";

  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    res.status(503).json({ error: "Telegram no está configurado." });
    return;
  }

  if (!texto || texto.trim().length < 5) {
    res.status(400).json({ error: "Falta el texto a enviar" });
    return;
  }

  try {
    const { titulo, contenido, tags } = parsearResultado(texto);

    // Generar imagen 1:1 para Instagram con Gemini. Si falla, seguimos sin foto IG.
    const imagenIG = await generarImagenIG(titulo, categoriaFinal);

    const [noticia] = await db
      .insert(noticiasTable)
      .values({
        titulo,
        contenido,
        tags,
        textoOriginal: textoOriginal ?? "",
        fuente: fuente ?? "",
        publicada: false,
        pendiente: true,
        imagenPortada: imagenPortada ?? "",
        imagenInstagram: imagenIG?.url ?? "",
        categoria: categoriaFinal,
      })
      .returning();

    // Mandar la foto IG como PRIMER mensaje (multipart) — para que el editor
    // la pueda descargar directo desde Telegram y subir al feed sin pasar por la web.
    if (imagenIG) {
      try {
        const form = new FormData();
        form.append("chat_id", chatId);
        form.append("caption", `📸 *Foto 1:1 para Instagram*\n_${titulo}_`);
        form.append("parse_mode", "Markdown");
        form.append(
          "photo",
          new Blob([new Uint8Array(imagenIG.buffer)], { type: imagenIG.mimeType }),
          `ig-${noticia.id}.${imagenIG.mimeType.includes("jpeg") ? "jpg" : "png"}`,
        );
        await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: "POST",
          body: form,
        });
      } catch (err) {
        req.log.warn({ err }, "No se pudo mandar la foto IG por Telegram, sigo con el texto");
      }
    }

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: "✅ Publicar", callback_data: `publicar_${noticia.id}` },
          { text: "✏️ Editar", callback_data: `editar_${noticia.id}` },
          { text: "❌ Rechazar", callback_data: `rechazar_${noticia.id}` },
        ],
      ],
    };

    // Texto completo como mensaje independiente — nunca como caption de foto.
    // La imagen se adjunta por separado vía el botón 📸 (telegram-webhook.ts).
    // Telegram admite hasta 4096 chars en sendMessage, vs 1024 en caption de imagen.
    const TELEGRAM_MAX = 4096;
    const encabezado = `📰 *NUEVA NOTA — River en Israel*\n\n*${titulo}*\n\n`;
    const pie = `\n\n${tags}\n\n_¿Publicamos esta nota en el sitio?_`;
    const maxCuerpo = TELEGRAM_MAX - encabezado.length - pie.length - 5;
    const cuerpo = contenido.length > maxCuerpo ? contenido.slice(0, maxCuerpo) + "…" : contenido;
    const mensajeTexto = encabezado + cuerpo + pie;

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: mensajeTexto,
        parse_mode: "Markdown",
        reply_markup: replyMarkup,
      }),
    });

    const tgData = await tgRes.json() as { ok: boolean; result?: { message_id: number } };

    if (!tgRes.ok || !tgData.ok) {
      req.log.error({ tgData }, "Error enviando a Telegram");
      res.status(500).json({ error: "Error al enviar a Telegram" });
      return;
    }

    const messageId = String(tgData.result?.message_id ?? "");
    if (messageId) {
      await db
        .update(noticiasTable)
        .set({ telegramMessageId: messageId })
        .where(eq(noticiasTable.id, noticia.id));
    }

    res.json({ ok: true, noticiaId: noticia.id });
  } catch (err) {
    req.log.error({ err }, "Error en enviar-telegram");
    res.status(500).json({ error: "Error de conexión con Telegram" });
  }
});

router.post("/test-scheduler", async (req, res) => {
  const { fuente } = req.body as { fuente?: string };
  const { ejecutarCiclo } = await import("../scheduler");
  res.json({ ok: true, mensaje: "Ciclo iniciado en segundo plano — mirá tu Telegram en ~60 segundos" });
  ejecutarCiclo(fuente).catch((err) => req.log.error({ err }, "Error en test-scheduler"));
});

export default router;
