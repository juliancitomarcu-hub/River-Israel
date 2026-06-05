import { Router } from "express";

const router = Router();

const MAX_NOMBRE = 60;
const MAX_PROPUESTA = 1000;

// Escapa caracteres especiales de Telegram Markdown (legacy) para evitar inyección.
function escaparMarkdown(s: string): string {
  return s.replace(/([_*`\[])/g, "\\$1");
}

router.post("/propuesta-evento", async (req, res) => {
  const { nombre, propuesta } = req.body as { nombre?: string; propuesta?: string };

  if (!propuesta?.trim()) {
    res.status(400).json({ error: "Escribí tu propuesta de evento" });
    return;
  }

  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    res.status(503).json({ error: "Sistema no disponible temporalmente" });
    return;
  }

  const nombreTxt = escaparMarkdown((nombre?.trim() || "Anónimo").slice(0, MAX_NOMBRE));
  const propuestaTxt = escaparMarkdown(propuesta.trim().slice(0, MAX_PROPUESTA));
  const text =
    `🗓️ *PROPUESTA DE EVENTO*\n\n` +
    `*De:* ${nombreTxt}\n` +
    `*Propuesta:* ${propuestaTxt}`;

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });

    if (!tgRes.ok) {
      const err = await tgRes.text();
      req.log.error({ err }, "Telegram error enviando propuesta de evento");
      res.status(500).json({ error: "Error al enviar la propuesta" });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error procesando propuesta de evento");
    res.status(500).json({ error: "Error interno" });
  }
});

export default router;
