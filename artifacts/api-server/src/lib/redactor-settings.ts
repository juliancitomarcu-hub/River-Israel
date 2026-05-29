import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";

// ─── SETTINGS PERSISTENTES DEL PANEL /redactor ───────────────────────────────
// Configuración editable desde el panel sin tocar código ni reiniciar el server.
// Se guarda en un JSON en disco; el scheduler lo relee en cada tick.

const SETTINGS_FILE = path.resolve("./redactor_settings.json");

export interface RedactorSettings {
  // Hora (0-23) en horario Israel para el resumen diario de hebreo.
  // null = desactivado (equivalente a RESUMEN_HEBREO_DIARIO=0).
  resumenHebreoHora: number | null;
  // Última fecha (YYYY-MM-DD en horario Israel) en que se envió el resumen.
  // Evita doble envío durante la hora configurada y sobrevive reinicios.
  resumenHebreoUltimoEnvio: string | null;
}

function defaults(): RedactorSettings {
  const desactivadoPorEnv = process.env.RESUMEN_HEBREO_DIARIO === "0";
  return {
    resumenHebreoHora: desactivadoPorEnv ? null : 9,
    resumenHebreoUltimoEnvio: null,
  };
}

function horaValida(h: unknown): h is number {
  return typeof h === "number" && Number.isInteger(h) && h >= 0 && h <= 23;
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
