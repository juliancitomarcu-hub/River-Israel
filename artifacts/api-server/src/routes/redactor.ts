import { Router, type IRouter } from "express";
import { ai } from "@workspace/integrations-gemini-ai";
import { db } from "@workspace/db";
import { noticiasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { PROMPT_MAESTRO } from "../lib/prompt-maestro";
import { PROMPT_MAESTRO_SELECCION } from "../lib/prompt-maestro-seleccion";
import { requireAdmin } from "../middleware/requireAdmin";
import { type CategoriaImagen } from "../lib/generar-imagen-ig";
import { credencialesTelegram, estadoTelegram } from "../lib/telegram-cred";
import { estadoWebhookPanel, registrarWebhook } from "../lib/telegram-webhook-registro";

function elegirPrompt(categoria: CategoriaImagen): string {
  return categoria === "seleccion" ? PROMPT_MAESTRO_SELECCION : PROMPT_MAESTRO;
}

const router: IRouter = Router();

router.use("/procesar-noticia", requireAdmin);
router.use("/enviar-telegram", requireAdmin);
router.use("/test-scheduler", requireAdmin);
router.use("/estado-bots", requireAdmin);
router.use("/probar-bot", requireAdmin);
router.use("/webhook-info", requireAdmin);
router.use("/registrar-webhook", requireAdmin);

/**
 * Estado de configuración de los bots de Telegram (River / Selección) para que
 * el panel del redactor muestre si cada uno está listo o le falta token/chat.
 * No expone tokens ni chat_ids, sólo flags booleanos.
 */
router.get("/estado-bots", (_req, res) => {
  res.json({
    river: estadoTelegram("river"),
    seleccion: estadoTelegram("seleccion"),
  });
});

/**
 * Estado en vivo de los webhooks de Telegram (River / Selección). Consulta
 * getWebhookInfo de Telegram y lo combina con el registro en memoria de este
 * proceso para avisar si cada webhook está realmente protegido (registrado con
 * la URL esperada y con secret_token). Telegram no expone el secret, así que la
 * señal de protección depende de que este proceso lo haya registrado con éxito.
 */
router.get("/webhook-info", async (req, res) => {
  try {
    const [river, seleccion] = await Promise.all([
      estadoWebhookPanel("river"),
      estadoWebhookPanel("seleccion"),
    ]);
    res.json({ river, seleccion });
  } catch (err) {
    req.log.error({ err }, "Error consultando estado de webhooks de Telegram");
    res.status(502).json({ error: "No se pudo consultar el estado de los webhooks." });
  }
});

/**
 * Re-registra el webhook de un bot con su secret_token. Útil cuando el panel
 * detecta que un webhook quedó sin proteger (registro previo o fallo de red al
 * arrancar). Devuelve el estado actualizado tras re-registrar.
 */
router.post("/registrar-webhook", async (req, res) => {
  const { categoria } = req.body as { categoria?: CategoriaImagen };
  const categoriaFinal = categoria === "seleccion" ? "seleccion" : "river";

  const registro = await registrarWebhook(categoriaFinal);
  if (!registro.ok) {
    req.log.warn({ categoria: categoriaFinal, error: registro.error }, "No se pudo re-registrar el webhook");
    res.status(502).json({
      ok: false,
      error: registro.error ?? "No se pudo registrar el webhook.",
    });
    return;
  }

  const estado = await estadoWebhookPanel(categoriaFinal);
  res.json({ ok: true, estado });
});

/**
 * Prueba de envío real de un bot de Telegram. A diferencia de /estado-bots
 * (que sólo verifica que las env vars existan y el chat_id tenga formato
 * válido), esto pega de verdad contra la API de Telegram y confirma de punta a
 * punta que el bot puede enviar: detecta tokens revocados, chats equivocados o
 * bots expulsados del grupo. Reporta éxito o el motivo real del fallo.
 */
router.post("/probar-bot", async (req, res) => {
  const { categoria } = req.body as { categoria?: CategoriaImagen };
  const categoriaFinal: CategoriaImagen = categoria === "seleccion" ? "seleccion" : "river";

  const cred = credencialesTelegram(categoriaFinal);
  if (!cred) {
    res.status(503).json({
      ok: false,
      error: categoriaFinal === "seleccion"
        ? "El bot de la Selección no está configurado (falta token o chat)."
        : "El bot de River no está configurado (falta token o chat).",
    });
    return;
  }
  const { token, chatId, marca } = cred;

  const ahora = new Date().toLocaleString("es-AR", { timeZone: "Asia/Jerusalem" });
  const mensaje = `✅ *Prueba de envío — ${marca}*\n\nEste es un mensaje de prueba enviado desde el panel del redactor. Si lo ves, el bot funciona correctamente.\n\n_${ahora} (hora Israel)_`;

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: mensaje,
        parse_mode: "Markdown",
      }),
    });

    const tgData = await tgRes.json() as { ok: boolean; description?: string };

    if (!tgRes.ok || !tgData.ok) {
      req.log.warn({ categoria: categoriaFinal, description: tgData.description }, "Prueba de bot de Telegram falló");
      res.status(502).json({
        ok: false,
        error: tgData.description
          ? `Telegram rechazó el envío: ${tgData.description}`
          : "Telegram rechazó el envío.",
      });
      return;
    }

    res.json({ ok: true, mensaje: `Mensaje de prueba enviado a ${marca}.` });
  } catch (err) {
    req.log.error({ err, categoria: categoriaFinal }, "Error de conexión probando bot de Telegram");
    res.status(502).json({ ok: false, error: "No se pudo conectar con Telegram." });
  }
});

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

  const cred = credencialesTelegram(categoriaFinal);
  if (!cred) {
    res.status(503).json({
      error: categoriaFinal === "seleccion"
        ? "El bot de Telegram de la Selección no está configurado."
        : "Telegram no está configurado.",
    });
    return;
  }
  const { token, chatId } = cred;

  if (!texto || texto.trim().length < 5) {
    res.status(400).json({ error: "Falta el texto a enviar" });
    return;
  }

  try {
    const { titulo, contenido, tags } = parsearResultado(texto);

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
        categoria: categoriaFinal,
      })
      .returning();

    // Mandar primero la foto de portada (si hay) para previsualización en Telegram.
    if (imagenPortada) {
      try {
        await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            photo: imagenPortada,
            caption: `🖼 _Foto de portada — ${titulo}_`,
            parse_mode: "Markdown",
          }),
        });
      } catch (err) {
        req.log.warn({ err }, "No se pudo mandar la foto de portada por Telegram, sigo con el texto");
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
    const encabezado = `📰 *NUEVA NOTA — ${cred.marca}*\n\n*${titulo}*\n\n`;
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
