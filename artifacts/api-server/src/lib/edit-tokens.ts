import { randomBytes } from "node:crypto";

const EDIT_TOKEN_TTL_MS = 30 * 60 * 1000;
const SESSION_TTL_MS = 30 * 60 * 1000;
// Sesión completa de admin (login con contraseña). Más larga que la efímera
// por noticia, pero finita: si dejás el panel abierto en una compu prestada,
// caduca sola.
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

interface EditTokenEntry {
  noticiaId: number;
  expiresAt: number;
}

interface SessionEntry {
  noticiaId: number;
  expiresAt: number;
}

interface AdminSessionEntry {
  expiresAt: number;
}

const editTokens = new Map<string, EditTokenEntry>();
const sessions = new Map<string, SessionEntry>();
const adminSessions = new Map<string, AdminSessionEntry>();

function purgeExpired(): void {
  const now = Date.now();
  for (const [k, v] of editTokens) if (v.expiresAt <= now) editTokens.delete(k);
  for (const [k, v] of sessions) if (v.expiresAt <= now) sessions.delete(k);
  for (const [k, v] of adminSessions) if (v.expiresAt <= now) adminSessions.delete(k);
}

export function createEditToken(noticiaId: number): string {
  purgeExpired();
  const token = randomBytes(24).toString("base64url");
  editTokens.set(token, { noticiaId, expiresAt: Date.now() + EDIT_TOKEN_TTL_MS });
  return token;
}

export function consumeEditToken(token: string): { noticiaId: number } | null {
  purgeExpired();
  const entry = editTokens.get(token);
  if (!entry) return null;
  editTokens.delete(token);
  if (entry.expiresAt <= Date.now()) return null;
  return { noticiaId: entry.noticiaId };
}

export function createNoticiaSession(noticiaId: number): { token: string; expiresAt: number } {
  purgeExpired();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_TTL_MS;
  sessions.set(token, { noticiaId, expiresAt });
  return { token, expiresAt };
}

export function getNoticiaSession(token: string): { noticiaId: number } | null {
  purgeExpired();
  const entry = sessions.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { noticiaId: entry.noticiaId };
}

// Sesión completa de admin (creada vía /admin/login con la contraseña).
// Tiene mismos permisos que el ADMIN_TOKEN permanente pero caduca sola.
export function createAdminSession(): { token: string; expiresAt: number } {
  purgeExpired();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  adminSessions.set(token, { expiresAt });
  return { token, expiresAt };
}

export function getAdminSession(token: string): { expiresAt: number } | null {
  purgeExpired();
  const entry = adminSessions.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return null;
  }
  return { expiresAt: entry.expiresAt };
}

export function revokeAdminSession(token: string): void {
  adminSessions.delete(token);
}
