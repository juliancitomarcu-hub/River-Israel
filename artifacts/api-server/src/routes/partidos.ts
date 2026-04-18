import { Router, type IRouter } from "express";
import * as fs from "fs";
import * as path from "path";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── OVERRIDE MANUAL DE PARTIDO ───────────────────────────────────────────────
// Permite corregir datos incorrectos de Promiedos sin tocar el código.
// Archivo: artifacts/api-server/partido-override.json
// Formato: { "horaIsrael": "03:30 🕐 Israel", "fecha": "09/04/2026", "expiraEnUTC": "2026-04-10T06:00:00Z" }

const OVERRIDE_FILE = path.resolve("./partido-override.json");

interface PartidoOverride {
  horaIsrael?: string;
  fecha?: string;
  expiraEnUTC?: string;   // ISO 8601 — el override se ignora después de esta fecha
}

function leerOverride(): PartidoOverride | null {
  try {
    const raw = JSON.parse(fs.readFileSync(OVERRIDE_FILE, "utf-8")) as PartidoOverride;
    if (raw.expiraEnUTC && new Date(raw.expiraEnUTC).getTime() < Date.now()) {
      return null; // Override expirado
    }
    return raw;
  } catch {
    return null;
  }
}

const RIVER_TEAM_ID = "igi";
const RIVER_URL_NAME = "river-plate";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "es-AR,es;q=0.9",
  "Referer": "https://www.promiedos.com.ar/",
};

let cachedBuildId: string | null = null;
let buildIdFetchedAt = 0;

async function obtenerBuildId(): Promise<string> {
  const ahora = Date.now();
  if (cachedBuildId && ahora - buildIdFetchedAt < 30 * 60 * 1000) {
    return cachedBuildId;
  }

  const res = await fetch("https://www.promiedos.com.ar/", { headers: HEADERS });
  const html = await res.text();
  const match = html.match(/"buildId":"([^"]+)"/);
  if (!match?.[1]) throw new Error("No se encontró el buildId de Promiedos");

  cachedBuildId = match[1];
  buildIdFetchedAt = ahora;
  return cachedBuildId;
}

interface PromediosTeam {
  name: string;
  short_name: string;
  url_name: string;
  id: string;
}

interface PromediosGame {
  id: string;
  stage_round_name?: string;
  winner: number;
  teams: PromediosTeam[];
  scores?: number[];
  status: { enum: number; name: string; short_name?: string };
  start_time?: string;
}

interface PromediosRow {
  num: number;
  result_status?: number;
  values: { key: string; value: string }[];
  entity: { type: number; object: PromediosTeam };
  game: PromediosGame;
}

export interface Partido {
  id: string;
  competicion: string;
  fecha: string;
  horaIsrael: string;
  equipoLocal: string;
  equipoVisitante: string;
  golesLocal: number | null;
  golesVisitante: number | null;
  estado: "FINALIZADO" | "PROXIMO" | "EN_CURSO";
  esLocalRiver: boolean;
  resultado: string | null;
  estadio?: string;
}

// ─── ISRAEL DST ───────────────────────────────────────────────────────────────
// Israel: verano IDT = UTC+3 / invierno IST = UTC+2.
// Ley israelí desde 2013:
//   • Empieza: último viernes de marzo a las 02:00 IST (= 00:00 UTC)
//   • Termina:  último domingo de octubre a las 02:00 IDT (= 23:00 UTC del día anterior)
//
// Calculamos manualmente para que funcione en cualquier entorno Node.js
// sin depender de datos ICU externos (Intl solo falla si la TZ database está incompleta).

function ultimoDiaSemana(year: number, month: number, weekday: number): number {
  // Devuelve el día del mes del último `weekday` (0=Dom…6=Sáb) del mes indicado.
  // month: 0-indexed (0=ene, 2=mar, 9=oct)
  const ultimoDia = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  for (let d = ultimoDia; d >= 1; d--) {
    if (new Date(Date.UTC(year, month, d)).getUTCDay() === weekday) return d;
  }
  return ultimoDia;
}

function israelOffsetHoras(utcMs: number): number {
  const d    = new Date(utcMs);
  const year = d.getUTCFullYear();

  // Inicio DST: último viernes (5) de marzo a las 00:00 UTC (= 02:00 IST)
  const inicioIDT = Date.UTC(year, 2, ultimoDiaSemana(year, 2, 5), 0, 0, 0);

  // Fin DST: último domingo (0) de octubre a las 23:00 UTC del viernes anterior
  // (= 02:00 IDT del domingo)
  const finIDT = Date.UTC(year, 9, ultimoDiaSemana(year, 9, 0), 23, 0, 0) - 24 * 3600_000;

  return utcMs >= inicioIDT && utcMs < finIDT ? 3 : 2;  // IDT (+3) o IST (+2)
}

// ─── CONVERSIÓN PRINCIPAL ─────────────────────────────────────────────────────
// Promiedos publica en UTC-4. Convertimos a hora de Israel respetando DST.

function convertirArgentinaAIsrael(startTime: string | undefined): { fecha: string; horaIsrael: string } {
  if (!startTime) return { fecha: "", horaIsrael: "" };
  const partes = startTime.split(" ");
  if (partes.length < 2) return { fecha: startTime, horaIsrael: "" };
  const [dia, mes, anio] = partes[0].split("-").map(Number);
  const [h, m] = partes[1].split(":").map(Number);
  if (!dia || !mes || !anio || isNaN(h) || isNaN(m)) return { fecha: "", horaIsrael: "" };

  // Promiedos UTC-4 → UTC (+4h)
  const utcMs  = Date.UTC(anio, mes - 1, dia, h + 4, m);
  const offset = israelOffsetHoras(utcMs);           // +3 (IDT) o +2 (IST)
  const ilDate = new Date(utcMs + offset * 3_600_000);

  const pad    = (n: number) => String(n).padStart(2, "0");
  return {
    fecha:      `${pad(ilDate.getUTCDate())}/${pad(ilDate.getUTCMonth() + 1)}/${ilDate.getUTCFullYear()}`,
    horaIsrael: `${pad(ilDate.getUTCHours())}:${pad(ilDate.getUTCMinutes())} 🕐 Israel`,
  };
}

// Fallback cuando Promiedos no envía fecha completa, solo HH:MM.
// Sin fecha no se puede calcular DST → asumimos IDT (+7h desde UTC-4) en verano.
function horaArgentinaAIsrael(horaAR: string): string {
  if (!horaAR) return "";
  const [h, m] = horaAR.split(":").map(Number);
  const horaIsrael = (h + 7) % 24;
  return `${String(horaIsrael).padStart(2, "0")}:${String(m).padStart(2, "0")} 🕐 Israel`;
}

function mapearPartido(row: PromediosRow, tipo: "proximo" | "resultado"): Partido {
  const game = row.game;
  const teams = game.teams ?? [];

  const esLocalRiver = teams[0]?.id === RIVER_TEAM_ID;
  const equipoLocal = teams[0]?.name ?? "";
  const equipoVisitante = teams[1]?.name ?? "";

  const dateVal = row.values.find((v) => v.key === "date")?.value ?? "";
  const timeVal = row.values.find((v) => v.key === "time")?.value ?? "";
  const resultVal = row.values.find((v) => v.key === "result")?.value ?? null;

  // Usar conversión correcta de timezone si tenemos start_time completo (incluye fecha)
  const { fecha: fechaIsrael, horaIsrael: horaIsraelConvertida } = convertirArgentinaAIsrael(game.start_time);
  const fechaFinal = fechaIsrael || dateVal;
  const horaIsrael = horaIsraelConvertida || (timeVal ? horaArgentinaAIsrael(timeVal) : "");

  // LOG DIAGNÓSTICO: ver start_time crudo, timeVal y hora calculada (detectar diferencia prod vs dev)
  if (tipo === "proximo") {
    logger.info({ startTimeRaw: game.start_time, timeVal, fechaFinal, horaIsrael }, "DST-diag partido");
  }

  const statusEnum = game.status?.enum ?? -1;
  let estado: Partido["estado"] = "PROXIMO";
  if (statusEnum === 3) estado = "FINALIZADO";
  else if (statusEnum === 2) estado = "EN_CURSO";

  const scores = game.scores;
  const golesLocal = scores?.[0] ?? null;
  const golesVisitante = scores?.[1] ?? null;

  const competicion = game.stage_round_name ?? "Partido";

  const estadioVal = row.values.find((v) => v.key === "stadium")?.value
    ?? ((game as any).venue?.name)
    ?? (esLocalRiver ? "Estadio Monumental" : undefined);

  return {
    id: game.id,
    competicion,
    fecha: fechaFinal,
    horaIsrael,
    equipoLocal,
    equipoVisitante,
    golesLocal: estado === "FINALIZADO" ? (golesLocal ?? null) : null,
    golesVisitante: estado === "FINALIZADO" ? (golesVisitante ?? null) : null,
    estado,
    esLocalRiver,
    resultado: resultVal,
    estadio: estadioVal,
  };
}

export interface Gol {
  minuto: number | string;
  jugador: string;
  esRiver: boolean;
}

export interface Formacion {
  nombre: string;
  numero?: number;
  posicion?: string;
  titular: boolean;
}

export interface PartidoDetallado {
  id: string;
  competicion: string;
  fecha: string;
  horaIsrael: string;
  equipoLocal: string;
  equipoVisitante: string;
  golesLocal: number | null;
  golesVisitante: number | null;
  estado: "PROXIMO" | "EN_CURSO" | "FINALIZADO";
  esLocalRiver: boolean;
  minuto?: string;
  goles: Gol[];
  alineacionLocal: Formacion[] | null;
  alineacionVisitante: Formacion[] | null;
  estadio?: string;
}

let cache: { data: Partido[]; at: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

let liveCache: { data: PartidoDetallado; at: number } | null = null;
const LIVE_CACHE_TTL = 30 * 1000; // 30 segundos

router.get("/partidos-river", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  try {
    const ahora = Date.now();
    if (cache && ahora - cache.at < CACHE_TTL) {
      res.json({ partidos: cache.data, cached: true });
      return;
    }

    const buildId = await obtenerBuildId();
    const url = `https://www.promiedos.com.ar/_next/data/${buildId}/team/${RIVER_URL_NAME}/${RIVER_TEAM_ID}.json?teamSlug=${RIVER_URL_NAME}&teamId=${RIVER_TEAM_ID}`;

    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) throw new Error(`Promiedos respondió ${response.status}`);

    const json = await response.json() as {
      pageProps?: {
        data?: {
          games?: {
            next?: { rows?: PromediosRow[] };
            last?: { rows?: PromediosRow[] };
          };
        };
      };
    };

    const games = json.pageProps?.data?.games;
    if (!games) throw new Error("Estructura de datos inesperada de Promiedos");

    const proximos = (games.next?.rows ?? []).map((r) => mapearPartido(r, "proximo"));
    const resultados = (games.last?.rows ?? []).map((r) => mapearPartido(r, "resultado"));

    // Próximos primero (más cercano arriba), luego últimos resultados (más reciente primero)
    const partidos = [...proximos, ...resultados.slice().reverse()];

    cache = { data: partidos, at: ahora };
    res.json({ partidos });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    // Si hay caché viejo, úsalo como fallback
    if (cache) {
      res.json({ partidos: cache.data, cached: true, warning: msg });
      return;
    }
    res.status(500).json({ error: `No se pudo obtener los partidos: ${msg}` });
  }
});

router.get("/partido-proximo", async (req, res) => {
  try {
    const ahora = Date.now();
    if (liveCache && ahora - liveCache.at < LIVE_CACHE_TTL) {
      res.json(liveCache.data);
      return;
    }

    const buildId = await obtenerBuildId();
    const url = `https://www.promiedos.com.ar/_next/data/${buildId}/team/${RIVER_URL_NAME}/${RIVER_TEAM_ID}.json?teamSlug=${RIVER_URL_NAME}&teamId=${RIVER_TEAM_ID}`;
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) throw new Error(`Promiedos respondió ${response.status}`);
    const json = await response.json() as any;

    const games = json.pageProps?.data?.games;
    const nextRows: PromediosRow[] = games?.next?.rows ?? [];
    const lastRows: PromediosRow[] = games?.last?.rows ?? [];
    const allRows = [...nextRows, ...lastRows];

    const liveRow = allRows.find((r) => r.game?.status?.enum === 2);
    const nextRow = nextRows[0];
    const baseRow = liveRow ?? nextRow;

    if (!baseRow) {
      res.status(404).json({ error: "No hay partidos próximos" });
      return;
    }

    const game = baseRow.game;
    const teams = game.teams ?? [];
    const esLocalRiver = teams[0]?.id === RIVER_TEAM_ID;
    const { fecha, horaIsrael } = convertirArgentinaAIsrael(game.start_time);
    const scores = game.scores ?? [];
    const statusEnum = game.status?.enum ?? -1;
    let estado: PartidoDetallado["estado"] = "PROXIMO";
    if (statusEnum === 3) estado = "FINALIZADO";
    else if (statusEnum === 2) estado = "EN_CURSO";

    let goles: Gol[] = [];
    let alineacionLocal: Formacion[] | null = null;
    let alineacionVisitante: Formacion[] | null = null;
    let minuto: string | undefined;

    if (estado === "EN_CURSO" || estado === "FINALIZADO") {
      try {
        const detailUrl = `https://www.promiedos.com.ar/_next/data/${buildId}/game/${game.id}.json`;
        const detailRes = await fetch(detailUrl, { headers: HEADERS });
        if (detailRes.ok) {
          const detail = await detailRes.json() as any;
          const gd = detail.pageProps?.data?.game ?? detail.pageProps?.data ?? {};

          const matchTime = gd.match_time ?? gd.game?.match_time ?? gd.current_time;
          if (matchTime != null) minuto = `${matchTime}'`;

          const events: any[] = gd.events ?? gd.game_events ?? gd.game?.events ?? [];
          goles = events
            .filter((e: any) => {
              const tid = e.type?.id ?? e.type_id ?? e.type;
              return tid === 1 || tid === 2 || tid === "goal" || e.type?.name?.toLowerCase().includes("gol");
            })
            .map((e: any) => ({
              minuto: e.minute ?? e.min ?? e.time ?? "?",
              jugador: e.player?.last_name ?? e.player?.name ?? e.player_name ?? "Gol",
              esRiver: e.team?.id === RIVER_TEAM_ID || e.team_id === RIVER_TEAM_ID,
            }));

          const squads: any[] = gd.squads ?? gd.lineups ?? gd.game?.squads ?? [];
          const parseSquad = (sq: any): Formacion[] =>
            (sq?.players ?? sq ?? []).map((p: any) => ({
              nombre: p.last_name ?? p.name ?? "Jugador",
              numero: p.number ?? p.shirt_number,
              posicion: p.position ?? p.pos,
              titular: p.starting ?? p.is_starting ?? false,
            }));

          if (squads.length >= 2) {
            alineacionLocal = parseSquad(squads[0]);
            alineacionVisitante = parseSquad(squads[1]);
          } else if (squads.home) {
            alineacionLocal = parseSquad(squads.home);
            alineacionVisitante = parseSquad(squads.away);
          }
        }
      } catch (_) {
        // Continuar sin detalle, devolvemos datos básicos
      }
    }

    const estadio = (game as any).venue?.name
      ?? (game as any).stadium?.name
      ?? (esLocalRiver ? "Estadio Monumental" : undefined);

    // Aplicar override manual si existe y no está expirado (corrige datos incorrectos de Promiedos)
    const override = estado === "PROXIMO" ? leerOverride() : null;

    const resultado: PartidoDetallado = {
      id: game.id,
      competicion: game.stage_round_name ?? "Partido",
      fecha:      override?.fecha      ?? fecha,
      horaIsrael: override?.horaIsrael ?? horaIsrael,
      equipoLocal: teams[0]?.name ?? "",
      equipoVisitante: teams[1]?.name ?? "",
      golesLocal: estado !== "PROXIMO" ? (scores[0] ?? 0) : null,
      golesVisitante: estado !== "PROXIMO" ? (scores[1] ?? 0) : null,
      estado,
      esLocalRiver,
      minuto,
      goles,
      alineacionLocal,
      alineacionVisitante,
      estadio,
    };

    if (estado === "EN_CURSO") {
      liveCache = { data: resultado, at: ahora };
    }

    res.json(resultado);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    res.status(500).json({ error: msg });
  }
});

export default router;
