import { Router, type IRouter } from "express";
import * as fs from "fs";
import * as path from "path";

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

// Equipos de países con UTC-4 (1 hora detrás de Argentina UTC-3).
// Promiedos muestra la hora local del equipo local → cuando el local es de UTC-4
// el tiempo aparece 1 hora menos de lo real en horario argentino, hay que sumar 1h extra.
// Bolivia (BOT = UTC-4), Venezuela (VET = UTC-4), Paraguay (PYT ≈ UTC-4 en invierno)
const EQUIPOS_UTC_MINUS_4 = new Set([
  // Bolivia
  "blooming", "always-ready", "bolivar", "oriente-petrolero", "the-strongest",
  "nacional-potosi", "guabira", "san-jose-oruro",
  // Venezuela
  "carabobo", "carabobo-fc", "caracas", "metropolitanos", "deportivo-tachira",
  "zamora", "monagas", "estudiantes-merida", "mineros-guayana",
  // Paraguay (invierno sin DST)
  "olimpia", "cerro-porteno", "libertad", "nacional-py", "tacuary",
  "general-caballero", "guarani", "sportivo-luqueno",
]);

// Convierte "DD-MM-YYYY HH:MM" (hora local del equipo local según Promiedos) a fecha e hora Israel.
// extraHoras: ajuste adicional en horas cuando el equipo local es de una zona UTC-4 (1h detrás de ART).
function convertirArgentinaAIsrael(startTime: string | undefined, extraHoras = 0): { fecha: string; horaIsrael: string } {
  if (!startTime) return { fecha: "", horaIsrael: "" };
  const partes = startTime.split(" ");
  if (partes.length < 2) return { fecha: startTime, horaIsrael: "" };
  const [dia, mes, anio] = partes[0].split("-").map(Number);
  const [h, m] = partes[1].split(":").map(Number);
  if (!dia || !mes || !anio || isNaN(h) || isNaN(m)) return { fecha: "", horaIsrael: "" };

  // Base: hora local del equipo local (Argentina o similar) → UTC
  // Argentina = UTC-3 → +3h para llegar a UTC
  // Israel verano (abr-oct) = UTC+3 → +3h más desde UTC
  // Si el equipo local es de UTC-4 (Bolivia, Venezuela, Paraguay), Promiedos muestra hora UTC-4
  //   → +4h para llegar a UTC (en vez de +3h)  → extraHoras = 1
  const offsetLocalAUtc = 3 + extraHoras; // horas a sumar para llegar a UTC
  const utcMs = Date.UTC(anio, mes - 1, dia, h + offsetLocalAUtc, m);
  const israelMs = utcMs + 3 * 60 * 60 * 1000; // UTC → Israel verano (UTC+3)
  const d = new Date(israelMs);

  const ilDia  = String(d.getUTCDate()).padStart(2, "0");
  const ilMes  = String(d.getUTCMonth() + 1).padStart(2, "0");
  const ilAnio = d.getUTCFullYear();
  const ilH    = String(d.getUTCHours()).padStart(2, "0");
  const ilMin  = String(d.getUTCMinutes()).padStart(2, "0");

  return {
    fecha:     `${ilDia}/${ilMes}/${ilAnio}`,
    horaIsrael: `${ilH}:${ilMin} 🕐 Israel`,
  };
}

// Compatibilidad con código que llama horaArgentinaAIsrael con una hora sola (sin fecha)
// Solo úsala cuando no tengás el start_time completo.
function horaArgentinaAIsrael(horaAR: string): string {
  if (!horaAR) return "";
  const [h, m] = horaAR.split(":").map(Number);
  const horaIsrael = (h + 6) % 24;
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

  // Detectar si el equipo local es de un país UTC-4 (Bolivia, Venezuela, Paraguay)
  // para corregir que Promiedos muestra hora local del equipo local.
  const homeUrlName = (teams[0]?.url_name ?? "").toLowerCase();
  const esLocalUtcMinus4 = EQUIPOS_UTC_MINUS_4.has(homeUrlName);
  const extraHoras = esLocalUtcMinus4 ? 1 : 0;

  // Usar conversión correcta de timezone si tenemos start_time completo (incluye fecha)
  const { fecha: fechaIsrael, horaIsrael: horaIsraelConvertida } = convertirArgentinaAIsrael(game.start_time, extraHoras);
  const fechaFinal = fechaIsrael || dateVal;
  const horaIsrael = horaIsraelConvertida || (timeVal ? horaArgentinaAIsrael(timeVal) : "");

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
    const homeUrlName = (teams[0]?.url_name ?? "").toLowerCase();
    const extraHorasWidget = EQUIPOS_UTC_MINUS_4.has(homeUrlName) ? 1 : 0;
    const { fecha, horaIsrael } = convertirArgentinaAIsrael(game.start_time, extraHorasWidget);
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
