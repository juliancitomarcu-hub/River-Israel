import { randomBytes, createHash } from "node:crypto";
import { db, editTokensTable, panelSessionsTable } from "@workspace/db";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { logger } from "./logger";
import { leerRedactorSettings } from "./redactor-settings";

// TTL corto POR DEFECTO para links de edición scoped a una nota recién creada
// (autopublicación del scheduler, botones del bot de Telegram). La duración
// real es configurable desde el panel /redactor (o por la env
// LINK_EDICION_TTL_MINUTOS); este valor es sólo el fallback.
export const EDIT_TOKEN_TTL_MS = 30 * 60 * 1000;
// TTL largo POR DEFECTO para links "de resumen" (resumen diario, aviso de
// traducción al hebreo): el admin puede abrir el Telegram a la noche y entrar a
// la mañana sin que el link caduque. No están scoped a una nota recién creada.
// La duración real es configurable desde el panel /redactor (o por la env
// LINK_RESUMEN_TTL_HORAS); este valor es sólo el fallback.
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

// Texto humano de la duración vigente de los links de edición por nota,
// para incluirlo en los avisos de Telegram (p. ej. "30 minutos", "2 horas",
// "1 hora y 30 minutos"). Usa el mismo valor efectivo que createEditToken.
export function descripcionTtlEdicion(): string {
  const minutosConfig = leerRedactorSettings().linkEdicionTtlMinutos;
  const totalMin =
    Number.isFinite(minutosConfig) && minutosConfig > 0
      ? Math.round(minutosConfig)
      : Math.round(EDIT_TOKEN_TTL_MS / 60000);
  if (totalMin < 60) return `${totalMin} minuto${totalMin === 1 ? "" : "s"}`;
  const horas = Math.floor(totalMin / 60);
  const resto = totalMin % 60;
  const horasTxt = `${horas} hora${horas === 1 ? "" : "s"}`;
  if (resto === 0) return horasTxt;
  return `${horasTxt} y ${resto} minuto${resto === 1 ? "" : "s"}`;
}

export async function createEditToken(
  noticiaId: number | null,
  ttlMs?: number,
): Promise<string> {
  // Sin TTL explícito, se usa la duración configurada en el panel /redactor
  // (linkEdicionTtlMinutos); si no hay un valor válido, cae al fallback de 30'.
  let ttl = ttlMs;
  if (ttl === undefined) {
    const minutos = leerRedactorSettings().linkEdicionTtlMinutos;
    ttl = Number.isFinite(minutos) && minutos > 0
      ? minutos * 60 * 1000
      : EDIT_TOKEN_TTL_MS;
  }
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + ttl);
  await db.insert(editTokensTable).values({ token, noticiaId, expiresAt });
  return token;
}

// Variante con TTL largo para links "de resumen" que el admin puede abrir horas
// después de recibir el aviso. La duración se lee de los settings del panel
// /redactor (configurable sin redeploy); si por algún motivo no hay un valor
// válido, cae al fallback de 24h.
export async function createLongEditToken(noticiaId: number | null): Promise<string> {
  const horas = leerRedactorSettings().linkResumenTtlHoras;
  const ttlMs = Number.isFinite(horas) && horas > 0
    ? horas * 60 * 60 * 1000
    : LONG_EDIT_TOKEN_TTL_MS;
  return createEditToken(noticiaId, ttlMs);
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

// Cuenta cuántas sesiones admin siguen vivas (no caducadas). Sirve para que
// el panel muestre "N sesiones activas" al lado del botón "salir de todos".
export async function countActiveAdminSessions(): Promise<number> {
  const now = new Date();
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(panelSessionsTable)
    .where(
      and(
        eq(panelSessionsTable.scope, "admin"),
        sql`${panelSessionsTable.expiresAt} > ${now}`,
      ),
    );
  return rows[0]?.count ?? 0;
}

// Identificador opaco derivado del token: SHA-256 truncado a 16 hex chars.
// Permite al panel referenciar una sesión específica sin exponer el token real.
function sessionIdFromToken(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

// Lista las sesiones admin vivas (no caducadas) sin exponer el token completo:
// devuelve un id opaco, creada/expira y un flag "actual" comparando contra el
// token del que pide. Ordenadas de más nueva a más vieja.
export async function listActiveAdminSessions(
  currentToken: string,
): Promise<Array<{ sessionId: string; createdAt: number; expiresAt: number; actual: boolean }>> {
  const now = new Date();
  const rows = await db
    .select({
      token: panelSessionsTable.token,
      createdAt: panelSessionsTable.createdAt,
      expiresAt: panelSessionsTable.expiresAt,
    })
    .from(panelSessionsTable)
    .where(
      and(
        eq(panelSessionsTable.scope, "admin"),
        sql`${panelSessionsTable.expiresAt} > ${now}`,
      ),
    )
    .orderBy(sql`${panelSessionsTable.createdAt} desc`);
  return rows.map((r) => ({
    sessionId: sessionIdFromToken(r.token),
    createdAt: r.createdAt.getTime(),
    expiresAt: r.expiresAt.getTime(),
    actual: r.token === currentToken,
  }));
}

// Revoca una sola sesión admin buscándola por su id opaco (hash del token).
// Devuelve si era la sesión del solicitante, o null si no existía o ya caducó.
export async function revokeAdminSessionById(
  sessionId: string,
  currentToken: string,
): Promise<{ actual: boolean } | null> {
  const now = new Date();
  // Traemos todas las sesiones admin vivas y buscamos cuál matchea el hash.
  const rows = await db
    .select({ token: panelSessionsTable.token })
    .from(panelSessionsTable)
    .where(
      and(
        eq(panelSessionsTable.scope, "admin"),
        sql`${panelSessionsTable.expiresAt} > ${now}`,
      ),
    );
  const match = rows.find((r) => sessionIdFromToken(r.token) === sessionId);
  if (!match) return null;
  await db.delete(panelSessionsTable).where(eq(panelSessionsTable.token, match.token));
  return { actual: match.token === currentToken };
}

export async function revokeAdminSession(token: string): Promise<void> {
  await db.delete(panelSessionsTable).where(eq(panelSessionsTable.token, token));
}

// Revoca TODAS las sesiones admin de golpe ("cerrar sesión en todos los
// dispositivos"). Borra cada fila con scope 'admin', incluida la del que pide.
// Las sesiones scoped a una noticia (links de Telegram) no se tocan. Devuelve
// cuántas filas se borraron para que la UI pueda mostrarlo si quiere.
export async function revokeAllAdminSessions(): Promise<number> {
  const rows = await db
    .delete(panelSessionsTable)
    .where(eq(panelSessionsTable.scope, "admin"))
    .returning({ token: panelSessionsTable.token });
  return rows.length;
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
