import { Router } from "express";

const router = Router();

router.post("/contacto", async (req, res) => {
  const { nombre, mensaje } = req.body as { nombre?: string; mensaje?: string };

  if (!nombre?.trim() || !mensaje?.trim()) {
    res.status(400).json({ error: "Nombre y mensaje son obligatorios" });
    return;
  }

  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    res.status(503).json({ error: "Sistema no disponible temporalmente" });
    return;
  }

  const text =
    `📬 *MENSAJE DE LA WEB*\n\n` +
    `*Nombre:* ${nombre.trim()}\n` +
    `*Mensaje:* ${mensaje.trim()}`;

  const waUrl = `https://wa.me/9720559421610?text=${encodeURIComponent(`Hola ${nombre.trim()}, vi tu mensaje en la web de River en Israel.`)}`;

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "📱 Responder por WhatsApp", url: waUrl },
          ]],
        },
      }),
    });

    if (!tgRes.ok) {
      const err = await tgRes.text();
      console.error("Telegram error:", err);
      res.status(500).json({ error: "Error al enviar el mensaje" });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("contacto error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

export default router;
