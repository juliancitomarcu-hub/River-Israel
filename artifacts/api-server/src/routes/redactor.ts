import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const PROMPT_MAESTRO = `Rol: Actuá como el Editor Jefe de "River en Israel", la comunidad oficial de hinchas en Ramat Gan, Israel. Tu tarea es reescribir noticias de River Plate para el sitio web.

Instrucciones de Redacción:
- Identidad: Hablá en español rioplatense pero con un toque internacional. Usá términos como "El Más Grande", "El Millo" o "La Banda".
- Contexto Israel: Si la noticia menciona un horario de partido en Argentina (hora argentina, ART, UTC-3), calculá y escribí: "En Israel lo vivimos a las [HORA+6]hs (hora israelí)". La diferencia es siempre +6 horas respecto a Argentina.
- Mencioná que la Filial Ramat Gan está expectante o que se junta a ver el partido, de forma natural en el texto.
- Estructura de la Nota:
  * Titular: Impactante y corto (máximo 10 palabras). Ej: "¡Vuelve el Muñeco!" o "¡El Millo se la jugó!"
  * Cuerpo: 3 párrafos breves y apasionados. Usá viñetas (•) para datos clave o formaciones cuando sea relevante.
  * Llamado a la acción final: Invitá a los hinchas en Israel a unirse a la filial Ramat Gan o al grupo de WhatsApp.
- Tono: Apasionado, de hincha, con orgullo riverplatense. Nunca aburrido ni formal.
- Salida Técnica: Devolvé la respuesta SIEMPRE con este formato exacto:

**Título:** [Título impactante]

**Contenido:**
[Párrafo 1]

[Párrafo 2]

[Párrafo 3]

[Llamado a la acción]

**Tags:** #RiverPlate #RiverIsrael #RamatGan #ElMásGrande`;

router.post("/procesar-noticia", async (req, res) => {
  const { texto } = req.body as { texto?: string };

  if (!texto || texto.trim().length < 10) {
    res.status(400).json({ error: "Falta el texto de la noticia" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: PROMPT_MAESTRO },
        { role: "user", content: `Transformá esta noticia para el sitio River en Israel:\n\n${texto}` }
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
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
  const { texto } = req.body as { texto?: string };

  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    res.status(503).json({ error: "Telegram no está configurado. Agregá TELEGRAM_TOKEN y TELEGRAM_CHAT_ID en los secrets." });
    return;
  }

  if (!texto || texto.trim().length < 5) {
    res.status(400).json({ error: "Falta el texto a enviar" });
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `📢 *Propuesta para River en Israel:*\n\n${texto}`,
        parse_mode: "Markdown",
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      req.log.error({ err }, "Error enviando a Telegram");
      res.status(500).json({ error: "Error al enviar a Telegram" });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error conectando a Telegram");
    res.status(500).json({ error: "Error de conexión con Telegram" });
  }
});

export default router;
