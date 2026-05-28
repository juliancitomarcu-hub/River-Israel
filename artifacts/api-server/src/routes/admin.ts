import { Router, type IRouter } from "express";
import { consumeEditToken, createNoticiaSession, getNoticiaSession } from "../lib/edit-tokens";

const router: IRouter = Router();

// Acepta el ADMIN_TOKEN permanente O una sesión scoped (canjeada desde un
// edit_token de Telegram). Esto último permite que, al recargar la página
// dentro de la ventana de la sesión, el token en sessionStorage siga siendo
// reconocido como "logueado" para la UI, aunque solo pueda usar los
// endpoints scoped a su noticia.
router.get("/admin/check", (req, res) => {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    res.status(503).json({ error: "Auth admin no configurada en el servidor" });
    return;
  }
  const header = req.header("x-admin-token");
  const query = typeof req.query.token === "string" ? req.query.token : undefined;
  const provided = header ?? query;
  if (!provided) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }
  if (provided === expected) {
    res.json({ ok: true, scope: "admin" });
    return;
  }
  const session = getNoticiaSession(provided);
  if (session) {
    res.json({ ok: true, scope: "noticia", noticiaId: session.noticiaId });
    return;
  }
  res.status(401).json({ error: "No autorizado" });
});

// Canjea un edit_token de un solo uso (enviado por Telegram al admin) por una
// sesión admin EFÍMERA. No devolvemos nunca el ADMIN_TOKEN permanente: si el
// link se filtra, lo peor que pueden obtener es una sesión corta y revocable.
router.post("/admin/exchange-edit-token", (req, res) => {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    req.log.error("ADMIN_TOKEN no está configurado — rechazando exchange");
    res.status(503).json({ error: "Auth admin no configurada en el servidor" });
    return;
  }
  const body = (req.body ?? {}) as { token?: unknown };
  const token = typeof body.token === "string" ? body.token : "";
  if (!token) {
    res.status(400).json({ error: "Falta token" });
    return;
  }
  const consumed = consumeEditToken(token);
  if (!consumed) {
    res.status(401).json({ error: "Token inválido o expirado" });
    return;
  }
  const session = createNoticiaSession(consumed.noticiaId);
  res.json({
    sessionToken: session.token,
    expiresAt: session.expiresAt,
    noticiaId: consumed.noticiaId,
  });
});

export default router;
