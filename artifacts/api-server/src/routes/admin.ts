import { Router, type IRouter, type Request, type Response } from "express";
import {
  ADMIN_SESSION_TTL_MS,
  SESSION_TTL_MS,
  consumeEditToken,
  createAdminSession,
  createNoticiaSession,
  extendAdminSession,
  extendNoticiaSession,
  getAdminSession,
  getNoticiaSession,
  revokeAdminSession,
} from "../lib/edit-tokens";

const router: IRouter = Router();

// Nombre y opciones de la cookie httpOnly que reemplaza al sessionToken en
// sessionStorage. SameSite=Strict porque el panel siempre se accede vía
// navegación same-origin (incluso el link de Telegram lleva al dominio nuestro
// y desde ahí se hace POST a /exchange-edit-token). Secure sólo en producción
// para no romper el preview HTTP local.
const COOKIE_NAME = "admin_session";
const isProd = (): boolean => process.env.NODE_ENV === "production";

function setSessionCookie(res: Response, token: string, maxAgeMs: number): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "strict",
    path: "/",
    maxAge: maxAgeMs,
  });
}

function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "strict",
    path: "/",
  });
}

// Extrae el token desde header (curl / scripts), cookie httpOnly (panel),
// body.token (compat) o query.token (links de Telegram). Cualquiera vale.
function extractToken(req: Request): string {
  const header = req.header("x-admin-token");
  if (header) return header;
  const cookies = (req as Request & { cookies?: Record<string, unknown> }).cookies;
  const cookie = typeof cookies?.admin_session === "string" ? cookies.admin_session : "";
  if (cookie) return cookie;
  const body = (req.body ?? {}) as { token?: unknown };
  const bodyTok = typeof body.token === "string" ? body.token : "";
  if (bodyTok) return bodyTok;
  const query = typeof req.query.token === "string" ? req.query.token : "";
  return query;
}

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
  const provided = extractToken(req);
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

// Login con la contraseña de admin: crea una sesión efímera y la guarda en una
// cookie httpOnly. Ya no devolvemos el sessionToken en el body — así nunca
// queda accesible para scripts (defensa contra XSS).
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
  setSessionCookie(res, session.token, ADMIN_SESSION_TTL_MS);
  res.json({ ok: true, expiresAt: session.expiresAt });
});

// Revoca la sesión admin actual (si la hay) y borra la cookie. Idempotente.
router.post("/admin/logout", (req, res) => {
  const provided = extractToken(req);
  if (provided) revokeAdminSession(provided);
  clearSessionCookie(res);
  res.json({ ok: true });
});

// Renueva la sesión actual sin pedir la contraseña: empuja el expiresAt
// hasta ahora + TTL completo. Sirve para el botón "Seguir conectado" del
// aviso amarillo en el Redactor, así el editor no pierde lo que está
// escribiendo. Sólo funciona con sesiones efímeras (admin o noticia); el
// ADMIN_TOKEN permanente no tiene caducidad y devuelve expiresAt=null.
router.post("/admin/renew", (req, res) => {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    res.status(503).json({ error: "Auth admin no configurada en el servidor" });
    return;
  }
  const provided = extractToken(req);
  if (!provided) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }
  if (provided === expected) {
    // Token permanente: no hay nada que extender, pero respondemos ok para
    // que la UI esconda el aviso sin romper.
    res.json({ ok: true, scope: "admin", expiresAt: null });
    return;
  }
  const renewedAdmin = extendAdminSession(provided);
  if (renewedAdmin) {
    // Re-emitimos la cookie para refrescar también su maxAge en el navegador.
    setSessionCookie(res, provided, ADMIN_SESSION_TTL_MS);
    res.json({ ok: true, scope: "admin", expiresAt: renewedAdmin.expiresAt });
    return;
  }
  const renewedNoticia = extendNoticiaSession(provided);
  if (renewedNoticia) {
    setSessionCookie(res, provided, SESSION_TTL_MS);
    res.json({ ok: true, scope: "noticia", expiresAt: renewedNoticia.expiresAt });
    return;
  }
  res.status(401).json({ error: "Sesión inválida o caducada" });
});

// Canjea un edit_token de un solo uso (enviado por Telegram al admin) por una
// sesión admin EFÍMERA. No devolvemos nunca el ADMIN_TOKEN permanente: si el
// link se filtra, lo peor que pueden obtener es una sesión corta y revocable.
router.post("/admin/exchange-edit-token", async (req, res) => {
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
  const consumed = await consumeEditToken(token);
  if (!consumed) {
    res.status(401).json({ error: "Token inválido o expirado" });
    return;
  }
  // Si el token estaba scoped a una noticia → sesión efímera scoped a esa nota.
  // Si no (ej: link del resumen diario de hebreo) → sesión admin completa corta.
  if (consumed.noticiaId === null) {
    const session = createAdminSession();
    setSessionCookie(res, session.token, ADMIN_SESSION_TTL_MS);
    res.json({
      ok: true,
      expiresAt: session.expiresAt,
      noticiaId: null,
    });
    return;
  }
  const session = createNoticiaSession(consumed.noticiaId);
  setSessionCookie(res, session.token, SESSION_TTL_MS);
  res.json({
    ok: true,
    expiresAt: session.expiresAt,
    noticiaId: consumed.noticiaId,
  });
});

export default router;
