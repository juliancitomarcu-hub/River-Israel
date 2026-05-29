import { randomBytes } from "node:crypto";
import { db, editTokensTable } from "@workspace/db";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { logger } from "./logger";

const EDIT_TOKEN_TTL_MS = 30 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 60 * 1000;
// Sesión completa de admin (login con contraseña). Más larga que la efímera
// por noticia, pero finita: si dejás el panel abierto en una compu prestada,
// caduca sola.
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

interface SessionEntry {
  noticiaId: number;
  expiresAt: number;
}

interface AdminSessionEntry {
  expiresAt: number;
}

// Sessions siguen en memoria (otra tarea: pasarlas a cookies seguras).
const sessions = new Map<string, SessionEntry>();
const adminSessions = new Map<string, AdminSessionEntry>();

function purgeExpiredSessions(): void {
  const now = Date.now();
  for (const [k, v] of sessions) if (v.expiresAt <= now) sessions.delete(k);
  for (const [k, v] of adminSessions) if (v.expiresAt <= now) adminSessions.delete(k);
}

// Limpia tokens expirados o ya usados hace más de un día. Se llama desde el
// scheduler cada cierto tiempo para que la tabla no crezca indefinidamente.
export async function purgeExpiredEditTokens(): Promise<void> {
  const now = new Date();
  const unDiaAtras = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    await db
      .delete(editTokensTable)
      .where(
        or(
          lt(editTokensTable.expiresAt, now),
          and(
            sql`${editTokensTable.usedAt} is not null`,
            lt(editTokensTable.usedAt, unDiaAtras),
          ),
        ),
      );
  } catch (err) {
    logger.error({ err }, "purgeExpiredEditTokens falló");
  }
}

export async function createEditToken(noticiaId: number | null): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + EDIT_TOKEN_TTL_MS);
  await db.insert(editTokensTable).values({ token, noticiaId, expiresAt });
  return token;
}

export async function consumeEditToken(
  token: string,
): Promise<{ noticiaId: number | null } | null> {
  // Marca usedAt atómicamente sólo si todavía no fue usado y no está expirado.
  // Devuelve la fila para saber a qué noticia apuntaba.
  const now = new Date();
  const rows = await db
    .update(editTokensTable)
    .set({ usedAt: now })
    .where(
      and(
        eq(editTokensTable.token, token),
        isNull(editTokensTable.usedAt),
        sql`${editTokensTable.expiresAt} > ${now}`,
      ),
    )
    .returning({ noticiaId: editTokensTable.noticiaId });
  const row = rows[0];
  if (!row) return null;
  return { noticiaId: row.noticiaId };
}

export function createNoticiaSession(noticiaId: number): { token: string; expiresAt: number } {
  purgeExpiredSessions();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_TTL_MS;
  sessions.set(token, { noticiaId, expiresAt });
  return { token, expiresAt };
}

export function getNoticiaSession(token: string): { noticiaId: number } | null {
  purgeExpiredSessions();
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
  purgeExpiredSessions();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  adminSessions.set(token, { expiresAt });
  return { token, expiresAt };
}

export function getAdminSession(token: string): { expiresAt: number } | null {
  purgeExpiredSessions();
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

// Renueva una sesión admin viva: empuja el expiresAt hasta ahora + TTL completo.
// No emite un token nuevo (la UI ya lo tiene guardado). Si la sesión no existe
// o ya caducó devuelve null y la UI tiene que mandar al login.
export function extendAdminSession(token: string): { expiresAt: number } | null {
  purgeExpiredSessions();
  const entry = adminSessions.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return null;
  }
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  entry.expiresAt = expiresAt;
  return { expiresAt };
}

// Mismo concepto para sesiones scoped a una noticia (links de Telegram).
export function extendNoticiaSession(token: string): { expiresAt: number } | null {
  purgeExpiredSessions();
  const entry = sessions.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  const expiresAt = Date.now() + SESSION_TTL_MS;
  entry.expiresAt = expiresAt;
  return { expiresAt };
}
