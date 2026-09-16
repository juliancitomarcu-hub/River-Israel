import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";
import { leerEstadoApp, guardarEstadoApp } from "./app-estado";

// ─── SETTINGS PERSISTENTES DEL PANEL /redactor ───────────────────────────────
// Configuración editable desde el panel sin tocar código ni reiniciar el server.
// Se guarda en la DB (tabla app_estado) para sobrevivir reinicios en producción;
// antes vivía en un JSON en disco que se perdía en cada reinicio.

const SETTINGS_FILE = path.resolve("./redactor_settings.json");
const SETTINGS_CLAVE = "redactor_settings";

// Rango permitido para la duración (en horas) de los links "de resumen".
// 1h mínimo (que sea útil) y 168h = 7 días máximo (más allá no tiene sentido
// para un aviso operativo y deja tokens vivos demasiado tiempo).
export const LINK_RESUMEN_TTL_HORAS_MIN = 1;
export const LINK_RESUMEN_TTL_HORAS_MAX = 168;
export const LINK_RESUMEN_TTL_HORAS_DEFAULT = 24;

// Rango permitido para la duración (en minutos) de los links de edición
// scoped a una nota recién creada (autopublicación del scheduler, botones del
// bot). 5 min mínimo (menos no da tiempo a abrirlo) y 1440 = 24h máximo (es un
// link efímero por nota; para durar más están los links "de resumen").
export const LINK_EDICION_TTL_MINUTOS_MIN = 5;
export const LINK_EDICION_TTL_MINUTOS_MAX = 1440;
export const LINK_EDICION_TTL_MINUTOS_DEFAULT = 30;

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
  // Duración (en minutos) de los links de edición por nota (los que llegan por
  // Telegram al crearse una nota). Configurable desde el panel o por la env
  // LINK_EDICION_TTL_MINUTOS. Reemplaza la constante fija de 30 min.
  linkEdicionTtlMinutos: number;
  // Interruptores por sección del resumen diario. Cada bandera decide si su
  // sección se consulta en la DB y aparece en el mensaje de Telegram. El default
  // se deriva de su env var correspondiente (fallback para no romper despliegues
  // que la usaban); una vez guardado un valor desde el panel, manda el archivo.
  resumenSeccionHebreo: boolean;
  resumenSeccionPostulaciones: boolean;
  resumenSeccionBorradoresEs: boolean;
}

function ttlHorasPorEnv(): number {
  const raw = process.env.LINK_RESUMEN_TTL_HORAS;
  if (raw === undefined) return LINK_RESUMEN_TTL_HORAS_DEFAULT;
  const n = Number.parseInt(raw, 10);
  return ttlHorasValido(n) ? n : LINK_RESUMEN_TTL_HORAS_DEFAULT;
}

function ttlMinutosPorEnv(): number {
  const raw = process.env.LINK_EDICION_TTL_MINUTOS;
  if (raw === undefined) return LINK_EDICION_TTL_MINUTOS_DEFAULT;
  const n = Number.parseInt(raw, 10);
  return ttlMinutosValido(n) ? n : LINK_EDICION_TTL_MINUTOS_DEFAULT;
}

function defaults(): RedactorSettings {
  const desactivadoPorEnv = process.env.RESUMEN_HEBREO_DIARIO === "0";
  return {
    resumenHebreoHora: desactivadoPorEnv ? null : 9,
    resumenHebreoUltimoEnvio: null,
    linkResumenTtlHoras: ttlHorasPorEnv(),
    linkEdicionTtlMinutos: ttlMinutosPorEnv(),
    resumenSeccionHebreo: process.env.RESUMEN_HEBREO_DIARIO !== "0",
    resumenSeccionPostulaciones: process.env.RESUMEN_POSTULACIONES_DIARIO !== "0",
    resumenSeccionBorradoresEs: process.env.RESUMEN_BORRADORES_ES_DIARIO !== "0",
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

export function ttlMinutosValido(m: unknown): m is number {
  return (
    typeof m === "number" &&
    Number.isInteger(m) &&
    m >= LINK_EDICION_TTL_MINUTOS_MIN &&
    m <= LINK_EDICION_TTL_MINUTOS_MAX
  );
}

// Cache en memoria: los llamadores son sincrónicos, así que mantenemos el
// último valor conocido acá y lo hidratamos desde la DB al arrancar el server.
let cache: RedactorSettings | null = null;

function normalizar(raw: Partial<RedactorSettings>): RedactorSettings {
  const def = defaults();
  return {
      resumenHebreoHora:
        raw.resumenHebreoHora === null ? null
          : horaValida(raw.resumenHebreoHora) ? raw.resumenHebreoHora
          : def.resumenHebreoHora,
      resumenHebreoUltimoEnvio:
        typeof raw.resumenHebreoUltimoEnvio === "string" ? raw.resumenHebreoUltimoEnvio : null,
      linkResumenTtlHoras:
        ttlHorasValido(raw.linkResumenTtlHoras) ? raw.linkResumenTtlHoras : def.linkResumenTtlHoras,
      linkEdicionTtlMinutos:
        ttlMinutosValido(raw.linkEdicionTtlMinutos) ? raw.linkEdicionTtlMinutos : def.linkEdicionTtlMinutos,
      resumenSeccionHebreo:
        typeof raw.resumenSeccionHebreo === "boolean" ? raw.resumenSeccionHebreo : def.resumenSeccionHebreo,
      resumenSeccionPostulaciones:
        typeof raw.resumenSeccionPostulaciones === "boolean" ? raw.resumenSeccionPostulaciones : def.resumenSeccionPostulaciones,
      resumenSeccionBorradoresEs:
        typeof raw.resumenSeccionBorradoresEs === "boolean" ? raw.resumenSeccionBorradoresEs : def.resumenSeccionBorradoresEs,
  };
}

function leerArchivoLegacy(): Partial<RedactorSettings> | null {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8")) as Partial<RedactorSettings>;
  } catch {
    return null;
  }
}

// Hidrata el cache desde la DB al arrancar el server (con migración desde el
// archivo local viejo si la DB todavía no tiene nada).
export async function initRedactorSettings(): Promise<void> {
  const desdeDb = await leerEstadoApp<Partial<RedactorSettings>>(SETTINGS_CLAVE);
  if (desdeDb) {
    cache = normalizar(desdeDb);
    return;
  }
  const legacy = leerArchivoLegacy();
  cache = normalizar(legacy ?? {});
  if (legacy) {
    await guardarEstadoApp(SETTINGS_CLAVE, cache);
  }
}

export function leerRedactorSettings(): RedactorSettings {
  if (cache) return cache;
  // Aún no hidratado desde la DB: usar archivo legacy o defaults, sin cachear
  // para que la hidratación posterior no quede pisada.
  return normalizar(leerArchivoLegacy() ?? {});
}

export function guardarRedactorSettings(patch: Partial<RedactorSettings>): RedactorSettings {
  const actual = leerRedactorSettings();
  const nuevo: RedactorSettings = { ...actual, ...patch };
  cache = nuevo;
  // Persistencia asíncrona en la DB (fire-and-forget con log de error).
  void guardarEstadoApp(SETTINGS_CLAVE, nuevo).catch((err) =>
    logger.warn({ err }, "No se pudo guardar redactor_settings en la DB"),
  );
  return nuevo;
}
