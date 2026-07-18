// Queries compartidas entre el resumen diario de Telegram (scheduler) y el
// endpoint de settings del panel /redactor, que muestra cuántos elementos hay
// pendientes en cada sección junto a su interruptor.
import { db, noticiasTable } from "@workspace/db";
import { and, desc, eq, sql as sqlRaw } from "drizzle-orm";

export interface PendienteResumen {
  id: number;
  titulo: string;
}

// Traducciones al hebreo en borrador (con contenido hebreo pero sin publicar).
export async function listarPendientesHebreo(): Promise<PendienteResumen[]> {
  return db
    .select({ id: noticiasTable.id, titulo: noticiasTable.titulo })
    .from(noticiasTable)
    .where(and(
      eq(noticiasTable.hebreoPublicada, false),
      sqlRaw`char_length(coalesce(${noticiasTable.contenidoHe}, '')) > 0`,
    ))
    .orderBy(desc(noticiasTable.id));
}

// Postulaciones de redactores sin revisar: `pendiente=true` y `fuente` que
// arranca con "Postulación".
export async function listarPendientesPostulaciones(): Promise<PendienteResumen[]> {
  return db
    .select({ id: noticiasTable.id, titulo: noticiasTable.titulo })
    .from(noticiasTable)
    .where(and(
      eq(noticiasTable.pendiente, true),
      sqlRaw`${noticiasTable.fuente} LIKE 'Postulación%'`,
    ))
    .orderBy(desc(noticiasTable.id));
}

// Borradores en español sin publicar (modo manual, esperando aprobación):
// `pendiente=true`, `publicada=false` y `fuente` que NO arranca con
// "Postulación" (esas ya van en su propia sección).
export async function listarPendientesBorradoresEs(): Promise<PendienteResumen[]> {
  return db
    .select({ id: noticiasTable.id, titulo: noticiasTable.titulo })
    .from(noticiasTable)
    .where(and(
      eq(noticiasTable.pendiente, true),
      eq(noticiasTable.publicada, false),
      sqlRaw`${noticiasTable.fuente} NOT LIKE 'Postulación%'`,
    ))
    .orderBy(desc(noticiasTable.id));
}

// Conteos de las tres secciones, consultados en paralelo. Usado por el panel.
export async function contarPendientesResumen(): Promise<{
  hebreo: number;
  postulaciones: number;
  borradoresEs: number;
}> {
  const [hebreo, postulaciones, borradoresEs] = await Promise.all([
    listarPendientesHebreo(),
    listarPendientesPostulaciones(),
    listarPendientesBorradoresEs(),
  ]);
  return {
    hebreo: hebreo.length,
    postulaciones: postulaciones.length,
    borradoresEs: borradoresEs.length,
  };
}
