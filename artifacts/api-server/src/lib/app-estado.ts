/**
 * Estado clave-valor persistente en la DB (tabla app_estado).
 * Reemplaza los JSON en disco que producción borra en cada reinicio.
 */

import { db, appEstadoTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";

export async function leerEstadoApp<T>(clave: string): Promise<T | null> {
  try {
    const [fila] = await db.select().from(appEstadoTable).where(eq(appEstadoTable.clave, clave)).limit(1);
    return (fila?.valor as T) ?? null;
  } catch (err) {
    logger.warn({ err, clave }, "app-estado: no se pudo leer");
    return null;
  }
}

export async function guardarEstadoApp(clave: string, valor: unknown): Promise<boolean> {
  try {
    await db
      .insert(appEstadoTable)
      .values({ clave, valor })
      .onConflictDoUpdate({
        target: appEstadoTable.clave,
        set: { valor, actualizadoEn: sql`now()` },
      });
    return true;
  } catch (err) {
    logger.warn({ err, clave }, "app-estado: no se pudo guardar");
    return false;
  }
}
