import { Router, type IRouter } from "express";
import {
  consumeEditToken,
  createAdminSession,
  createNoticiaSession,
  getAdminSession,
  getNoticiaSession,
  revokeAdminSession,
} from "../lib/edit-tokens";

const router: IRouter = Router();

// Acepta el ADMIN_TOKEN permanente (uso interno / curl), una sesión admin
// creada vía /admin/login, O una sesión scoped (canjeada desde un edit_token
// de Telegram). Las sesiones devuelven su expiresAt para que la UI pueda
// avisar antes de que caduque.
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
    res.json({ ok: true, scope: "admin", expiresAt: null });
    return;
  }
  const adminSession = getAdminSession(provided);
  if (adminSession) {
    res.json({ ok: true, scope: "admin", expiresAt: adminSession.expiresAt });
    return;
  }
  const session = getNoticiaSession(provided);
  if (session) {
    res.json({ ok: true, scope: "noticia", noticiaId: session.noticiaId });
    return;
  }
  res.status(401).json({ error: "No autorizado" });
});

// Login con la contraseña de admin: devuelve una sesión efímera. Así nunca
// guardamos el ADMIN_TOKEN permanente en el navegador.
router.post("/admin/login", (req, res) => {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    req.log.error("ADMIN_TOKEN no está configurado — rechazando login");
    res.status(503).json({ error: "Auth admin no configurada en el servidor" });
    return;
  }
  const body = (req.body ?? {}) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";
  if (!password) {
    res.status(400).json({ error: "Falta contraseña" });
    return;
  }
  if (password !== expected) {
    res.status(401).json({ error: "Contraseña incorrecta" });
    return;
  }
  const session = createAdminSession();
  res.json({ sessionToken: session.token, expiresAt: session.expiresAt });
});

// Revoca la sesión admin actual (si la hay). Idempotente.
router.post("/admin/logout", (req, res) => {
  const header = req.header("x-admin-token");
  const body = (req.body ?? {}) as { token?: unknown };
  const provided = header ?? (typeof body.token === "string" ? body.token : "");
  if (provided) revokeAdminSession(provided);
  res.json({ ok: true });
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
