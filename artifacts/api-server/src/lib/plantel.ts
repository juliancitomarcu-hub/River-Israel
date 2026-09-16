import { guardarEstadoApp, leerEstadoApp } from "./app-estado";
import { logger } from "./logger";
import {
  API_PLANTEL_OFICIAL,
  type PlantelProfesional,
  validarPlantelAlmacenado,
} from "./plantel-parser";
import { actualizarPlantelConDependencias } from "./plantel-updater";

export {
  API_PLANTEL_OFICIAL,
  FUENTE_PLANTEL_OFICIAL,
  type JugadorPlantel,
  type PlantelProfesional,
  type PosicionPlantel,
} from "./plantel-parser";

export const ESTADO_CLAVE_PLANTEL = "plantel_profesional";

/**
 * Fetches and validates the official River API before doing a single DB write.
 * Any error deliberately leaves app_estado untouched, preserving the last good
 * roster that the public API and bot can continue using.
 */
export async function actualizarPlantelProfesional(): Promise<PlantelProfesional> {
  const plantel = await actualizarPlantelConDependencias({
    fetch: (url, init) => fetch(url, init),
    guardarEstado: guardarEstadoApp,
    claveEstado: ESTADO_CLAVE_PLANTEL,
  });
  logger.info({ jugadores: plantel.jugadores.length, actualizadoEn: plantel.actualizadoEn }, "Plantel profesional actualizado desde la fuente oficial");
  return plantel;
}

export async function leerPlantelProfesional(): Promise<PlantelProfesional | null> {
  const valor = await leerEstadoApp<unknown>(ESTADO_CLAVE_PLANTEL);
  return validarPlantelAlmacenado(valor);
}

/**
 * Explicit roster context for the editorial bot. It is built only from the
 * same persisted record served by GET /api/plantel; there is no player-list
 * fallback in source code.
 */
export async function contextoPlantelParaPrompt(): Promise<string> {
  const plantel = await leerPlantelProfesional();
  if (!plantel) {
    return "PLANTEL OFICIAL EN DB: no hay un plantel validado disponible. No menciones jugadores como integrantes actuales salvo que la fuente interna lo confirme explícitamente.";
  }

  const jugadores = plantel.jugadores
    .map((jugador) => `${jugador.nombre} ${jugador.apellido} (${jugador.posicion}${jugador.numero === null ? "" : `, #${jugador.numero}`})`)
    .join("; ");
  return `PLANTEL OFICIAL EN DB (actualizado ${plantel.actualizadoEn}, fuente ${plantel.fuente}): ${jugadores}. Esta lista solamente confirma quién integra el plantel y su posición oficial; no la uses para inventar titularidades, lesiones, convocatorias, transferencias o hechos que no estén en la fuente interna.`;
}