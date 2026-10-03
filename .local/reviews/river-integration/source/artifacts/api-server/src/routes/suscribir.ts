import { Router } from "express";
import { db, suscriptoresTable } from "@workspace/db";

const router = Router();

const CANALES_PERMITIDOS = new Set(["email", "whatsapp", "telegram"]);

router.post("/suscribir", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const nom = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const em = typeof body.email === "string" ? body.email.trim() : "";
  const tel = typeof body.telefono === "string" ? body.telefono.trim() : "";
  const ciudad = typeof body.ciudad === "string" ? body.ciudad.trim() : "";
  const canalesRaw = Array.isArray(body.canales) ? body.canales : null;

  if (nom.length < 2) {
    res.status(400).json({ error: "El nombre es obligatorio" });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    res.status(400).json({ error: "Email inválido" });
    return;
  }
  if (tel.length > 0 && tel.length < 6) {
    res.status(400).json({ error: "Teléfono inválido" });
    return;
  }
  if (!canalesRaw) {
    res.status(400).json({ error: "Canales inválidos" });
    return;
  }
  const canales = canalesRaw
    .filter((c): c is string => typeof c === "string" && CANALES_PERMITIDOS.has(c));
  if (canales.length === 0) {
    res.status(400).json({ error: "Elegí al menos un canal válido" });
    return;
  }

  const canalesStr = canales.join(",");

  try {
    await db.insert(suscriptoresTable).values({
      nombre: nom,
      email: em,
      telefono: tel,
      ciudad: ciudad ?? "",
      canales: canalesStr,
    });
  } catch (err) {
    req.log.error({ err }, "Error guardando suscriptor");
    res.status(500).json({ error: "Error al guardar suscripción" });
    return;
  }

  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (token && chatId) {
    const text =
      `🔔 *NUEVO SUSCRIPTOR*\n\n` +
      `*Nombre:* ${nom}\n` +
      `*Email:* ${em}\n` +
      (tel ? `*Teléfono:* ${tel}\n` : "") +
      (ciudad ? `*Ciudad:* ${ciudad}\n` : "") +
      `*Canales:* ${canalesStr}`;
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    }).catch((err) => req.log.warn({ err }, "Telegram notify suscriptor falló"));
  }

  res.json({ ok: true });
});

export default router;
