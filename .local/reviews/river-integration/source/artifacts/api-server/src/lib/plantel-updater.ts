import {
  API_PLANTEL_OFICIAL,
  type PlantelProfesional,
  normalizarPlantelOficial,
} from "./plantel-parser";

const HEADERS = {
  Accept: "application/json",
  "User-Agent": "River-en-Israel roster updater (+https://riverplateisrael.com)",
};

export interface DependenciasActualizadorPlantel {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  guardarEstado: (clave: string, valor: PlantelProfesional) => Promise<boolean>;
  claveEstado: string;
  ahora?: () => string;
}

/**
 * The updater has injected I/O so failures can be tested without a database or
 * network. It does not call guardarEstado until the complete official envelope
 * has passed validation, which protects the previously persisted roster.
 */
export async function actualizarPlantelConDependencias(
  dependencias: DependenciasActualizadorPlantel,
): Promise<PlantelProfesional> {
  const response = await dependencias.fetch(API_PLANTEL_OFICIAL, {
    headers: HEADERS,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Plantel oficial respondió HTTP ${response.status}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Plantel oficial devolvió JSON inválido");
  }

  const plantel = normalizarPlantelOficial(payload, dependencias.ahora?.());
  const guardado = await dependencias.guardarEstado(dependencias.claveEstado, plantel);
  if (!guardado) {
    throw new Error("No se pudo persistir el plantel oficial validado");
  }
  return plantel;
}