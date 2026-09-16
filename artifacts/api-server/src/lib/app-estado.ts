/**
 * Estado clave-valor persistente en la DB (tabla app_estado).
 * Reemplaza los JSON en disco que producción borra en cada reinicio.
 */

import { db, appEstadoTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";

const RETRYABLE_SQL_STATES = new Set([
  "08000", // connection_exception
  "08001", // sqlclient_unable_to_establish_sqlconnection
  "08003", // connection_does_not_exist
  "08004", // sqlserver_rejected_establishment_of_sqlconnection
  "08006", // connection_failure
  "08007", // transaction_resolution_unknown
  "53300", // too_many_connections
  "57P01", // admin_shutdown
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now
] as const);

const NON_RETRYABLE_SQL_STATES = new Set([
  "28000", // invalid_authorization_specification
  "28P01", // invalid_password
  "3F000", // invalid_schema_name
  "42P01", // undefined_table
  "42501", // insufficient_privilege
] as const);

const TRANSIENT_NETWORK_CODES = new Set([
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
  "ERR_SOCKET_TIMEOUT",
  "ETIMEDOUT",
] as const);

type AllowlistedSqlState =
  | "08000"
  | "08001"
  | "08003"
  | "08004"
  | "08006"
  | "08007"
  | "28000"
  | "28P01"
  | "3F000"
  | "42P01"
  | "42501"
  | "53300"
  | "57P01"
  | "57P02"
  | "57P03";

export type AppEstadoErrorClassification =
  | "transient_connection"
  | "transient_auth_timeout"
  | "authentication"
  | "permission"
  | "missing_schema"
  | "other";

export interface AppEstadoErrorInfo {
  reintentar: boolean;
  clasificacion: AppEstadoErrorClassification;
  sqlState: AllowlistedSqlState | null;
}

interface ErrorDetails {
  message: string;
  code: string | null;
}

function esObjeto(value: unknown): value is object {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

function propiedadSegura(value: object, key: string): unknown {
  try {
    return Reflect.get(value, key);
  } catch {
    return undefined;
  }
}

function cadenaSegura(value: unknown): string | null {
  return typeof value === "string" ? value.slice(0, 4_096) : null;
}

function detallesDeError(error: unknown): ErrorDetails[] {
  const detalles: ErrorDetails[] = [];
  const vistos = new Set<object>();

  const visitar = (value: unknown, profundidad: number): void => {
    if (profundidad > 4) return;

    if (typeof value === "string") {
      detalles.push({ message: cadenaSegura(value) ?? "", code: null });
      return;
    }
    if (!esObjeto(value) || vistos.has(value)) return;
    vistos.add(value);

    const message = cadenaSegura(propiedadSegura(value, "message")) ?? "";
    const codeValue =
      cadenaSegura(propiedadSegura(value, "code")) ??
      cadenaSegura(propiedadSegura(value, "sqlState")) ??
      cadenaSegura(propiedadSegura(value, "sqlstate")) ??
      cadenaSegura(propiedadSegura(value, "errno"));
    detalles.push({ message, code: codeValue?.toUpperCase() ?? null });

    visitar(propiedadSegura(value, "cause"), profundidad + 1);
  };

  visitar(error, 0);
  return detalles;
}

function esFalloNoReintentable(detalles: ErrorDetails[]): boolean {
  return detalles.some(({ message, code }) => {
    if (code && NON_RETRYABLE_SQL_STATES.has(code as never)) return true;
    return (
      /password authentication failed/i.test(message) ||
      /\bauth(?:entication)?\s+(?:failed|error|rejected|denied)\b/i.test(message) ||
      /\binvalid authorization specification\b/i.test(message) ||
      /\bpermission denied\b/i.test(message) ||
      /\binsufficient privilege\b/i.test(message) ||
      /\b(?:relation|table|schema|database)\b.*\bdoes not exist\b/i.test(message) ||
      /\bundefined table\b/i.test(message)
    );
  });
}

function esTimeoutDeAutenticacion(message: string): boolean {
  return (
    /\bauth(?:entication)?\b[\s\S]{0,80}\b(?:timed?\s*out|timeout)\b/i.test(message) ||
    /\b(?:timed?\s*out|timeout)\b[\s\S]{0,80}\bauth(?:entication)?\b/i.test(message)
  );
}

function esConexionTransitoria(message: string): boolean {
  return (
    /\b(?:ECONNABORTED|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|EPIPE|ERR_SOCKET_TIMEOUT|ETIMEDOUT)\b/i.test(message) ||
    /\btimeout expired\b/i.test(message) ||
    /\b(?:connect(?:ion)?|socket|network|database)\b[\s\S]{0,100}\b(?:timed?\s*out|timeout|reset by peer|refused|unreachable|terminated unexpectedly|closed unexpectedly)\b/i.test(message) ||
    /\b(?:timed?\s*out|timeout|reset by peer|refused|unreachable|terminated unexpectedly|closed unexpectedly)\b[\s\S]{0,100}\b(?:connect(?:ion)?|socket|network|database)\b/i.test(message)
  );
}

function sqlStatePermitido(detalles: ErrorDetails[]): AllowlistedSqlState | null {
  for (const { code } of detalles) {
    if (code && NON_RETRYABLE_SQL_STATES.has(code as never)) {
      return code as AllowlistedSqlState;
    }
  }
  for (const { code } of detalles) {
    if (code && RETRYABLE_SQL_STATES.has(code as never)) {
      return code as AllowlistedSqlState;
    }
  }
  return null;
}

/**
 * Classifies only the database failures that are safe to retry once.
 * Property access and `cause` traversal are defensive because database
 * drivers/wrappers do not share one error shape. No message or query data is
 * returned to callers or logs.
 */
export function clasificarErrorDb(error: unknown): AppEstadoErrorInfo {
  const detalles = detallesDeError(error);
  const codigo = sqlStatePermitido(detalles);

  if (esFalloNoReintentable(detalles)) {
    const clasificacion =
      detalles.some(({ message }) => /\bauth(?:entication)?\b/i.test(message)) ||
      codigo === "28000" ||
      codigo === "28P01"
        ? "authentication"
        : codigo === "3F000" || codigo === "42P01"
          ? "missing_schema"
          : codigo === "42501" || detalles.some(({ message }) => /permission|privilege/i.test(message))
            ? "permission"
            : "other";
    return { reintentar: false, clasificacion, sqlState: codigo };
  }

  const authTimeout = detalles.some(({ message }) => esTimeoutDeAutenticacion(message));
  if (authTimeout) {
    return { reintentar: true, clasificacion: "transient_auth_timeout", sqlState: codigo };
  }

  const networkCode = detalles.some(({ code }) =>
    code !== null && TRANSIENT_NETWORK_CODES.has(code as never),
  );
  const transientState = detalles.some(({ code }) =>
    code !== null && RETRYABLE_SQL_STATES.has(code as never),
  );
  const transientMessage = detalles.some(({ message }) => esConexionTransitoria(message));
  if (networkCode || transientState || transientMessage) {
    return { reintentar: true, clasificacion: "transient_connection", sqlState: codigo };
  }

  return { reintentar: false, clasificacion: "other", sqlState: codigo };
}

export function esErrorDbTransitorio(error: unknown): boolean {
  return clasificarErrorDb(error).reintentar;
}

type Operacion = "leer" | "upsert";

function claveParaLog(clave: string): string {
  return clave.length > 128 ? `${clave.slice(0, 125)}...` : clave;
}

function camposErrorParaLog(
  clave: string,
  operacion: Operacion,
  info: AppEstadoErrorInfo,
  reintentos: number,
): Record<string, string | number> {
  const campos: Record<string, string | number> = {
    clave: claveParaLog(clave),
    operacion,
    reintentos,
    clasificacion: info.clasificacion,
  };
  if (info.sqlState) campos.sqlState = info.sqlState;
  return campos;
}

async function ejecutarConUnReintento<T>(
  clave: string,
  operacion: Operacion,
  consulta: () => Promise<T>,
): Promise<T> {
  try {
    return await consulta();
  } catch (error) {
    const primerFallo = clasificarErrorDb(error);
    if (!primerFallo.reintentar) {
      logger.warn(
        camposErrorParaLog(clave, operacion, primerFallo, 0),
        `app-estado: no se pudo ${operacion === "leer" ? "leer" : "guardar"}`,
      );
      throw error;
    }

    logger.warn(
      camposErrorParaLog(clave, operacion, primerFallo, 0),
      "app-estado: error transitorio de DB; reintentando una vez",
    );

    try {
      const resultado = await consulta();
      logger.info(
        camposErrorParaLog(clave, operacion, primerFallo, 1),
        "app-estado: reintento de DB exitoso",
      );
      return resultado;
    } catch (retryError) {
      const segundoFallo = clasificarErrorDb(retryError);
      logger.warn(
        camposErrorParaLog(clave, operacion, segundoFallo, 1),
        `app-estado: no se pudo ${operacion === "leer" ? "leer" : "guardar"}`,
      );
      throw retryError;
    }
  }
}

export async function leerEstadoApp<T>(clave: string): Promise<T | null> {
  try {
    return await ejecutarConUnReintento(clave, "leer", async () => {
      const [fila] = await db.select().from(appEstadoTable).where(eq(appEstadoTable.clave, clave)).limit(1);
      return (fila?.valor as T) ?? null;
    });
  } catch {
    return null;
  }
}

export async function guardarEstadoApp(clave: string, valor: unknown): Promise<boolean> {
  try {
    return await ejecutarConUnReintento(clave, "upsert", async () => {
      await db
        .insert(appEstadoTable)
        .values({ clave, valor })
        .onConflictDoUpdate({
          target: appEstadoTable.clave,
          set: { valor, actualizadoEn: sql`now()` },
        });
      return true;
    });
  } catch {
    return false;
  }
}
