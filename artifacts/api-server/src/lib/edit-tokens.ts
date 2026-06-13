import { randomBytes } from "node:crypto";
import { db, editTokensTable, panelSessionsTable } from "@workspace/db";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { logger } from "./logger";

const EDIT_TOKEN_TTL_MS = 30 * 60 * 1000;
// TTL largo para links "de resumen" (resumen diario, aviso de traducción al
// hebreo): el admin puede abrir el Telegram a la noche y entrar a la mañana
// sin que el link caduque. No están scoped a una nota recién creada.
export const LONG_EDIT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 60 * 1000;
// Sesión completa de admin (login con contraseña). Más larga que la efímera
// por noticia, pero finita: si dejás el panel abierto en una compu prestada,
// caduca sola.
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// Limpia sesiones del panel (admin + noticia) ya caducadas. Se llama desde el
// scheduler junto con purgeExpiredEditTokens para que la tabla no crezca.
export async function purgeExpiredSessions(): Promise<void> {
  try {
    await db
      .delete(panelSessionsTable)
      .where(lt(panelSessionsTable.expiresAt, new Date()));
  } catch (err) {
    logger.error({ err }, "purgeExpiredSessions falló");
  }
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

export async function createEditToken(
  noticiaId: number | null,
  ttlMs: number = EDIT_TOKEN_TTL_MS,
): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlMs);
  await db.insert(editTokensTable).values({ token, noticiaId, expiresAt });
  return token;
}

// Variante con TTL largo (24h) para links "de resumen" que el admin puede
// abrir horas después de recibir el aviso.
export async function createLongEditToken(noticiaId: number | null): Promise<string> {
  return createEditToken(noticiaId, LONG_EDIT_TOKEN_TTL_MS);
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

export async function createNoticiaSession(
  noticiaId: number,
): Promise<{ token: string; expiresAt: number }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAtMs = Date.now() + SESSION_TTL_MS;
  await db.insert(panelSessionsTable).values({
    token,
    scope: "noticia",
    noticiaId,
    expiresAt: new Date(expiresAtMs),
  });
  return { token, expiresAt: expiresAtMs };
}

export async function getNoticiaSession(token: string): Promise<{ noticiaId: number } | null> {
  const now = new Date();
  const rows = await db
    .select({ noticiaId: panelSessionsTable.noticiaId })
    .from(panelSessionsTable)
    .where(
      and(
        eq(panelSessionsTable.token, token),
        eq(panelSessionsTable.scope, "noticia"),
        sql`${panelSessionsTable.expiresAt} > ${now}`,
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row || row.noticiaId === null) return null;
  return { noticiaId: row.noticiaId };
}

// Sesión completa de admin (creada vía /admin/login con la contraseña).
// Tiene mismos permisos que el ADMIN_TOKEN permanente pero caduca sola.
export async function createAdminSession(): Promise<{ token: string; expiresAt: number }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAtMs = Date.now() + ADMIN_SESSION_TTL_MS;
  await db.insert(panelSessionsTable).values({
    token,
    scope: "admin",
    noticiaId: null,
    expiresAt: new Date(expiresAtMs),
  });
  return { token, expiresAt: expiresAtMs };
}

export async function getAdminSession(token: string): Promise<{ expiresAt: number } | null> {
  const now = new Date();
  const rows = await db
    .select({ expiresAt: panelSessionsTable.expiresAt })
    .from(panelSessionsTable)
    .where(
      and(
        eq(panelSessionsTable.token, token),
        eq(panelSessionsTable.scope, "admin"),
        sql`${panelSessionsTable.expiresAt} > ${now}`,
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { expiresAt: row.expiresAt.getTime() };
}

export async function revokeAdminSession(token: string): Promise<void> {
  await db.delete(panelSessionsTable).where(eq(panelSessionsTable.token, token));
}

// Renueva una sesión admin viva: empuja el expiresAt hasta ahora + TTL completo.
// No emite un token nuevo (la UI ya lo tiene guardado). Si la sesión no existe
// o ya caducó devuelve null y la UI tiene que mandar al login.
export async function extendAdminSession(token: string): Promise<{ expiresAt: number } | null> {
  const now = new Date();
  const expiresAtMs = Date.now() + ADMIN_SESSION_TTL_MS;
  const rows = await db
    .update(panelSessionsTable)
    .set({ expiresAt: new Date(expiresAtMs) })
    .where(
      and(
        eq(panelSessionsTable.token, token),
        eq(panelSessionsTable.scope, "admin"),
        sql`${panelSessionsTable.expiresAt} > ${now}`,
      ),
    )
    .returning({ token: panelSessionsTable.token });
  if (!rows[0]) return null;
  return { expiresAt: expiresAtMs };
}

// Mismo concepto para sesiones scoped a una noticia (links de Telegram).
export async function extendNoticiaSession(token: string): Promise<{ expiresAt: number } | null> {
  const now = new Date();
  const expiresAtMs = Date.now() + SESSION_TTL_MS;
  const rows = await db
    .update(panelSessionsTable)
    .set({ expiresAt: new Date(expiresAtMs) })
    .where(
      and(
        eq(panelSessionsTable.token, token),
        eq(panelSessionsTable.scope, "noticia"),
        sql`${panelSessionsTable.expiresAt} > ${now}`,
      ),
    )
    .returning({ token: panelSessionsTable.token });
  if (!rows[0]) return null;
  return { expiresAt: expiresAtMs };
}
