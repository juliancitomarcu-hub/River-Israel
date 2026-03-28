import { Router, type IRouter } from "express";

const router: IRouter = Router();

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
}

function parsearFechaHora(startTime: string | undefined): { fecha: string; horaArgentina: string } {
  if (!startTime) return { fecha: "", horaArgentina: "" };
  // Format: "28-09-2025 17:00"
  const partes = startTime.split(" ");
  if (partes.length < 2) return { fecha: startTime, horaArgentina: "" };
  const [dia, mes, anio] = partes[0].split("-");
  const hora = partes[1];
  const fecha = `${dia}/${mes}/${anio}`;
  return { fecha, horaArgentina: hora };
}

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

  const { fecha, horaArgentina } = parsearFechaHora(game.start_time);
  const fechaFinal = fecha || dateVal;
  const horaIsrael = timeVal ? horaArgentinaAIsrael(timeVal) : (horaArgentina ? horaArgentinaAIsrael(horaArgentina) : "");

  const statusEnum = game.status?.enum ?? -1;
  let estado: Partido["estado"] = "PROXIMO";
  if (statusEnum === 3) estado = "FINALIZADO";
  else if (statusEnum === 2) estado = "EN_CURSO";

  const scores = game.scores;
  const golesLocal = scores?.[0] ?? null;
  const golesVisitante = scores?.[1] ?? null;

  const competicion = game.stage_round_name ?? "Partido";

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
  };
}

let cache: { data: Partido[]; at: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

router.get("/partidos-river", async (req, res) => {
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

    // Mostrar primero los últimos resultados (más reciente primero), luego próximos
    const partidos = [...resultados.reverse(), ...proximos];

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

export default router;
