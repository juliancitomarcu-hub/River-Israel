import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";

// ─── SETTINGS PERSISTENTES DEL PANEL /redactor ───────────────────────────────
// Configuración editable desde el panel sin tocar código ni reiniciar el server.
// Se guarda en un JSON en disco; el scheduler lo relee en cada tick.

const SETTINGS_FILE = path.resolve("./redactor_settings.json");

// Rango permitido para la duración (en horas) de los links "de resumen".
// 1h mínimo (que sea útil) y 168h = 7 días máximo (más allá no tiene sentido
// para un aviso operativo y deja tokens vivos demasiado tiempo).
export const LINK_RESUMEN_TTL_HORAS_MIN = 1;
export const LINK_RESUMEN_TTL_HORAS_MAX = 168;
export const LINK_RESUMEN_TTL_HORAS_DEFAULT = 24;

export interface RedactorSettings {
  // Hora (0-23) en horario Israel para el resumen diario de hebreo.
  // null = desactivado (equivalente a RESUMEN_HEBREO_DIARIO=0).
  resumenHebreoHora: number | null;
  // Última fecha (YYYY-MM-DD en horario Israel) en que se envió el resumen.
  // Evita doble envío durante la hora configurada y sobrevive reinicios.
  resumenHebreoUltimoEnvio: string | null;
  // Duración (en horas) de los links "de resumen" (resumen diario + aviso de
  // traducción al hebreo). Configurable desde el panel o por env. Reemplaza la
  // constante fija de 24h.
  linkResumenTtlHoras: number;
}

function ttlHorasPorEnv(): number {
  const raw = process.env.LINK_RESUMEN_TTL_HORAS;
  if (raw === undefined) return LINK_RESUMEN_TTL_HORAS_DEFAULT;
  const n = Number.parseInt(raw, 10);
  return ttlHorasValido(n) ? n : LINK_RESUMEN_TTL_HORAS_DEFAULT;
}

function defaults(): RedactorSettings {
  const desactivadoPorEnv = process.env.RESUMEN_HEBREO_DIARIO === "0";
  return {
    resumenHebreoHora: desactivadoPorEnv ? null : 9,
    resumenHebreoUltimoEnvio: null,
    linkResumenTtlHoras: ttlHorasPorEnv(),
  };
}

function horaValida(h: unknown): h is number {
  return typeof h === "number" && Number.isInteger(h) && h >= 0 && h <= 23;
}

export function ttlHorasValido(h: unknown): h is number {
  return (
    typeof h === "number" &&
    Number.isInteger(h) &&
    h >= LINK_RESUMEN_TTL_HORAS_MIN &&
    h <= LINK_RESUMEN_TTL_HORAS_MAX
  );
}

export function leerRedactorSettings(): RedactorSettings {
  const def = defaults();
  try {
    const raw = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8")) as Partial<RedactorSettings>;
    return {
      resumenHebreoHora:
        raw.resumenHebreoHora === null ? null
          : horaValida(raw.resumenHebreoHora) ? raw.resumenHebreoHora
          : def.resumenHebreoHora,
      resumenHebreoUltimoEnvio:
        typeof raw.resumenHebreoUltimoEnvio === "string" ? raw.resumenHebreoUltimoEnvio : null,
      linkResumenTtlHoras:
        ttlHorasValido(raw.linkResumenTtlHoras) ? raw.linkResumenTtlHoras : def.linkResumenTtlHoras,
    };
  } catch {
    // Archivo ausente o ilegible → usar defaults derivados del env.
    return def;
  }
}

export function guardarRedactorSettings(patch: Partial<RedactorSettings>): RedactorSettings {
  const actual = leerRedactorSettings();
  const nuevo: RedactorSettings = { ...actual, ...patch };
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(nuevo), "utf-8");
  } catch (err) {
    logger.warn({ err }, "No se pudo guardar redactor_settings");
  }
  return nuevo;
}
