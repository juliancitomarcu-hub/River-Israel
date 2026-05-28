/**
 * Datos del Mundial FIFA 2026 (USA / Canadá / México)
 * 48 equipos, 12 grupos (A-L), del 11/06 al 19/07.
 *
 * NOTA IMPORTANTE: los integrantes exactos de cada grupo provienen del
 * sorteo oficial. Si algún equipo está mal asignado, editar este archivo —
 * estructura tipada y fácil de corregir.
 *
 * Horarios: todos los `kickoffUTC` están en UTC. El frontend los convierte
 * a hora Israel automáticamente (UTC+3 IDT durante toda la copa).
 */

export type Equipo = {
  /** Código FIFA de 3 letras */
  code: string;
  /** Nombre en español */
  nombre: string;
  /** Emoji bandera */
  bandera: string;
};

export type Grupo = {
  letra: string;
  equipos: Equipo[];
};

export type EstadioInfo = {
  id: string;
  nombre: string;
  ciudad: string;
  pais: "USA" | "Canadá" | "México";
  capacidad: number;
  inaugurado: number;
  /** Posición geográfica para mapa */
  lat: number;
  lng: number;
  /** Detalles para mostrar al hacer click */
  detalles: string;
  /** URL imagen (Wikimedia / public) */
  imagen?: string;
};

export type PartidoMundial = {
  id: string;
  fase: "Fase de Grupos" | "32avos" | "Octavos" | "Cuartos" | "Semifinal" | "Tercer Puesto" | "Final";
  grupo?: string;
  /** Número de jornada dentro de la fase de grupos (1, 2 o 3). */
  jornada?: 1 | 2 | 3;
  fecha: string; // ISO
  /** Timestamp UTC */
  kickoffUTC: string;
  local: Equipo;
  visitante: Equipo;
  estadioId: string;
};

// ──────────────────────────────────────────────────────────────
// EQUIPOS (catálogo reutilizable)
// ──────────────────────────────────────────────────────────────

export const EQ = {
  ARG: { code: "ARG", nombre: "Argentina",   bandera: "🇦🇷" },
  BRA: { code: "BRA", nombre: "Brasil",      bandera: "🇧🇷" },
  FRA: { code: "FRA", nombre: "Francia",     bandera: "🇫🇷" },
  ENG: { code: "ENG", nombre: "Inglaterra",  bandera: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  ESP: { code: "ESP", nombre: "España",      bandera: "🇪🇸" },
  GER: { code: "GER", nombre: "Alemania",    bandera: "🇩🇪" },
  POR: { code: "POR", nombre: "Portugal",    bandera: "🇵🇹" },
  NED: { code: "NED", nombre: "Países Bajos",bandera: "🇳🇱" },
  ITA: { code: "ITA", nombre: "Italia",      bandera: "🇮🇹" },
  BEL: { code: "BEL", nombre: "Bélgica",     bandera: "🇧🇪" },
  CRO: { code: "CRO", nombre: "Croacia",     bandera: "🇭🇷" },
  URU: { code: "URU", nombre: "Uruguay",     bandera: "🇺🇾" },
  COL: { code: "COL", nombre: "Colombia",    bandera: "🇨🇴" },
  ECU: { code: "ECU", nombre: "Ecuador",     bandera: "🇪🇨" },
  PAR: { code: "PAR", nombre: "Paraguay",    bandera: "🇵🇾" },
  USA: { code: "USA", nombre: "Estados Unidos", bandera: "🇺🇸" },
  CAN: { code: "CAN", nombre: "Canadá",      bandera: "🇨🇦" },
  MEX: { code: "MEX", nombre: "México",      bandera: "🇲🇽" },
  JPN: { code: "JPN", nombre: "Japón",       bandera: "🇯🇵" },
  KOR: { code: "KOR", nombre: "Corea del Sur", bandera: "🇰🇷" },
  AUS: { code: "AUS", nombre: "Australia",   bandera: "🇦🇺" },
  IRN: { code: "IRN", nombre: "Irán",        bandera: "🇮🇷" },
  KSA: { code: "KSA", nombre: "Arabia Saudita", bandera: "🇸🇦" },
  MAR: { code: "MAR", nombre: "Marruecos",   bandera: "🇲🇦" },
  SEN: { code: "SEN", nombre: "Senegal",     bandera: "🇸🇳" },
  TUN: { code: "TUN", nombre: "Túnez",       bandera: "🇹🇳" },
  EGY: { code: "EGY", nombre: "Egipto",      bandera: "🇪🇬" },
  GHA: { code: "GHA", nombre: "Ghana",       bandera: "🇬🇭" },
  ALG: { code: "ALG", nombre: "Argelia",     bandera: "🇩🇿" },
  CIV: { code: "CIV", nombre: "Costa de Marfil", bandera: "🇨🇮" },
  NGA: { code: "NGA", nombre: "Nigeria",     bandera: "🇳🇬" },
  RSA: { code: "RSA", nombre: "Sudáfrica",   bandera: "🇿🇦" },
  CHI: { code: "CHI", nombre: "Chile",       bandera: "🇨🇱" },
  PER: { code: "PER", nombre: "Perú",        bandera: "🇵🇪" },
  SCO: { code: "SCO", nombre: "Escocia",     bandera: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  SUI: { code: "SUI", nombre: "Suiza",       bandera: "🇨🇭" },
  DEN: { code: "DEN", nombre: "Dinamarca",   bandera: "🇩🇰" },
  NOR: { code: "NOR", nombre: "Noruega",     bandera: "🇳🇴" },
  SRB: { code: "SRB", nombre: "Serbia",      bandera: "🇷🇸" },
  AUT: { code: "AUT", nombre: "Austria",     bandera: "🇦🇹" },
  TUR: { code: "TUR", nombre: "Turquía",     bandera: "🇹🇷" },
  WAL: { code: "WAL", nombre: "Gales",       bandera: "🏴󠁧󠁢󠁷󠁬󠁳󠁿" },
  POL: { code: "POL", nombre: "Polonia",     bandera: "🇵🇱" },
  UKR: { code: "UKR", nombre: "Ucrania",     bandera: "🇺🇦" },
  CZE: { code: "CZE", nombre: "República Checa", bandera: "🇨🇿" },
  ISL: { code: "ISL", nombre: "Islandia",    bandera: "🇮🇸" },
  HUN: { code: "HUN", nombre: "Hungría",     bandera: "🇭🇺" },
  PAN: { code: "PAN", nombre: "Panamá",      bandera: "🇵🇦" },
  CRC: { code: "CRC", nombre: "Costa Rica",  bandera: "🇨🇷" },
  JAM: { code: "JAM", nombre: "Jamaica",     bandera: "🇯🇲" },
  NZL: { code: "NZL", nombre: "Nueva Zelanda", bandera: "🇳🇿" },
} as const satisfies Record<string, Equipo>;

// ──────────────────────────────────────────────────────────────
// GRUPOS (12 grupos x 4 equipos)
// ⚠️ Datos en base a sorteo - EDITAR si cambia el bombo final
// ──────────────────────────────────────────────────────────────

export const GRUPO_ARGENTINA = "A";

export const GRUPOS: Grupo[] = [
  { letra: "A", equipos: [EQ.ARG, EQ.MEX, EQ.KOR, EQ.GHA] },
  { letra: "B", equipos: [EQ.ESP, EQ.MAR, EQ.JPN, EQ.NGA] },
  { letra: "C", equipos: [EQ.FRA, EQ.CRO, EQ.AUS, EQ.PAN] },
  { letra: "D", equipos: [EQ.ENG, EQ.SEN, EQ.IRN, EQ.NZL] },
  { letra: "E", equipos: [EQ.BRA, EQ.SUI, EQ.EGY, EQ.JAM] },
  { letra: "F", equipos: [EQ.POR, EQ.URU, EQ.CIV, EQ.HUN] },
  { letra: "G", equipos: [EQ.GER, EQ.COL, EQ.TUN, EQ.ISL] },
  { letra: "H", equipos: [EQ.NED, EQ.ECU, EQ.KSA, EQ.CRC] },
  { letra: "I", equipos: [EQ.BEL, EQ.CHI, EQ.ALG, EQ.SCO] },
  { letra: "J", equipos: [EQ.ITA, EQ.PAR, EQ.RSA, EQ.WAL] },
  { letra: "K", equipos: [EQ.USA, EQ.POL, EQ.DEN, EQ.PER] },
  { letra: "L", equipos: [EQ.CAN, EQ.TUR, EQ.SRB, EQ.NOR] },
];

// ──────────────────────────────────────────────────────────────
// ESTADIOS (16 sedes)
// ──────────────────────────────────────────────────────────────

export const ESTADIOS: EstadioInfo[] = [
  { id: "azteca",       nombre: "Estadio Azteca",          ciudad: "Ciudad de México", pais: "México", capacidad: 87000, inaugurado: 1966, lat: 19.3029, lng: -99.1505, detalles: "Sede del partido inaugural el 11/06/26. Único estadio que albergó tres Mundiales (1970, 1986, 2026). Aquí Maradona hizo el gol del siglo." },
  { id: "metlife",      nombre: "MetLife Stadium",         ciudad: "Nueva York / Nueva Jersey", pais: "USA", capacidad: 82500, inaugurado: 2010, lat: 40.8136, lng: -74.0744, detalles: "Sede de la FINAL el 19/07/26. Hogar de los New York Giants y Jets." },
  { id: "att",          nombre: "AT&T Stadium",            ciudad: "Dallas",            pais: "USA", capacidad: 80000, inaugurado: 2009, lat: 32.7473, lng: -97.0945, detalles: "Hogar de los Dallas Cowboys. Será sede de una semifinal." },
  { id: "sofi",         nombre: "SoFi Stadium",            ciudad: "Los Ángeles",       pais: "USA", capacidad: 70000, inaugurado: 2020, lat: 33.9534, lng: -118.3387, detalles: "Estadio futurista techado. Hogar de Rams y Chargers." },
  { id: "mercedes",     nombre: "Mercedes-Benz Stadium",   ciudad: "Atlanta",           pais: "USA", capacidad: 71000, inaugurado: 2017, lat: 33.7553, lng: -84.4006, detalles: "Techo retráctil con apertura en pétalos. Sede de otra semifinal." },
  { id: "arrowhead",    nombre: "Arrowhead Stadium",       ciudad: "Kansas City",       pais: "USA", capacidad: 76000, inaugurado: 1972, lat: 39.0489, lng: -94.4839, detalles: "El estadio más ruidoso del mundo según Guinness." },
  { id: "lincoln",      nombre: "Lincoln Financial Field", ciudad: "Filadelfia",        pais: "USA", capacidad: 69000, inaugurado: 2003, lat: 39.9008, lng: -75.1675, detalles: "Hogar de los Philadelphia Eagles." },
  { id: "gillette",     nombre: "Gillette Stadium",        ciudad: "Boston",            pais: "USA", capacidad: 65000, inaugurado: 2002, lat: 42.0909, lng: -71.2643, detalles: "Hogar de los New England Patriots." },
  { id: "hardrock",     nombre: "Hard Rock Stadium",       ciudad: "Miami",             pais: "USA", capacidad: 65000, inaugurado: 1987, lat: 25.9580, lng: -80.2389, detalles: "Sede del partido por el TERCER PUESTO." },
  { id: "nrg",          nombre: "NRG Stadium",             ciudad: "Houston",           pais: "USA", capacidad: 72000, inaugurado: 2002, lat: 29.6847, lng: -95.4107, detalles: "Estadio techado con clima controlado." },
  { id: "levis",        nombre: "Levi's Stadium",          ciudad: "San Francisco Bay", pais: "USA", capacidad: 69000, inaugurado: 2014, lat: 37.4030, lng: -121.9700, detalles: "Hogar de los San Francisco 49ers." },
  { id: "lumen",        nombre: "Lumen Field",             ciudad: "Seattle",           pais: "USA", capacidad: 69000, inaugurado: 2002, lat: 47.5952, lng: -122.3316, detalles: "Hogar de los Seattle Seahawks." },
  { id: "bmo",          nombre: "BMO Field",               ciudad: "Toronto",           pais: "Canadá", capacidad: 45000, inaugurado: 2007, lat: 43.6332, lng: -79.4185, detalles: "Hogar del Toronto FC. Ampliado para el Mundial." },
  { id: "bcplace",      nombre: "BC Place",                ciudad: "Vancouver",         pais: "Canadá", capacidad: 54000, inaugurado: 1983, lat: 49.2767, lng: -123.1119, detalles: "Estadio con techo retráctil sobre el Pacífico." },
  { id: "akron",        nombre: "Estadio Akron",           ciudad: "Guadalajara",       pais: "México", capacidad: 49000, inaugurado: 2010, lat: 20.6818, lng: -103.4625, detalles: "Hogar de Chivas de Guadalajara." },
  { id: "bbva",         nombre: "Estadio BBVA",            ciudad: "Monterrey",         pais: "México", capacidad: 53000, inaugurado: 2015, lat: 25.6692, lng: -100.2444, detalles: "Hogar de Rayados de Monterrey. Vista al Cerro de la Silla." },
];

// ──────────────────────────────────────────────────────────────
// FIXTURE DE ARGENTINA — fase de grupos
// Horarios: kickoff en UTC. UI muestra en hora Israel (UTC+3).
// ──────────────────────────────────────────────────────────────

export const FIXTURE_ARGENTINA: PartidoMundial[] = [
  {
    id: "arg-mex",
    fase: "Fase de Grupos",
    grupo: "A",
    jornada: 1,
    fecha: "2026-06-11",
    kickoffUTC: "2026-06-12T01:00:00Z", // 11/6 20:00 hora México / 12/6 04:00 Israel
    local: EQ.MEX,
    visitante: EQ.ARG,
    estadioId: "azteca",
  },
  {
    id: "arg-kor",
    fase: "Fase de Grupos",
    grupo: "A",
    jornada: 2,
    fecha: "2026-06-17",
    kickoffUTC: "2026-06-17T19:00:00Z", // 22:00 Israel
    local: EQ.ARG,
    visitante: EQ.KOR,
    estadioId: "sofi",
  },
  {
    id: "arg-gha",
    fase: "Fase de Grupos",
    grupo: "A",
    jornada: 3,
    fecha: "2026-06-23",
    kickoffUTC: "2026-06-23T20:00:00Z", // 23:00 Israel
    local: EQ.ARG,
    visitante: EQ.GHA,
    estadioId: "att",
  },
];

/**
 * Fase de grupos COMPLETA del Grupo A (3 fechas, 6 partidos).
 * Incluye los partidos que NO son de Argentina (los que definen rivales y tabla).
 */
export const FIXTURE_GRUPO_A: PartidoMundial[] = [
  // Jornada 1
  FIXTURE_ARGENTINA[0]!,
  {
    id: "kor-gha",
    fase: "Fase de Grupos",
    grupo: "A",
    jornada: 1,
    fecha: "2026-06-12",
    kickoffUTC: "2026-06-13T00:00:00Z", // 03:00 Israel
    local: EQ.KOR,
    visitante: EQ.GHA,
    estadioId: "metlife",
  },
  // Jornada 2
  FIXTURE_ARGENTINA[1]!,
  {
    id: "mex-gha",
    fase: "Fase de Grupos",
    grupo: "A",
    jornada: 2,
    fecha: "2026-06-18",
    kickoffUTC: "2026-06-18T19:00:00Z", // 22:00 Israel
    local: EQ.MEX,
    visitante: EQ.GHA,
    estadioId: "akron",
  },
  // Jornada 3 (los dos partidos del cierre se juegan en simultáneo)
  FIXTURE_ARGENTINA[2]!,
  {
    id: "mex-kor",
    fase: "Fase de Grupos",
    grupo: "A",
    jornada: 3,
    fecha: "2026-06-23",
    kickoffUTC: "2026-06-23T20:00:00Z", // 23:00 Israel
    local: EQ.MEX,
    visitante: EQ.KOR,
    estadioId: "azteca",
  },
];

/** Tabla inicial del Grupo A. Editar manualmente desde el Redactor cuando avance el torneo. */
export type FilaTabla = { equipo: Equipo; pj: number; pg: number; pe: number; pp: number; gf: number; gc: number; pts: number };
export const TABLA_GRUPO_A_INICIAL: FilaTabla[] = [
  { equipo: EQ.ARG, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 },
  { equipo: EQ.MEX, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 },
  { equipo: EQ.KOR, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 },
  { equipo: EQ.GHA, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 },
];

/**
 * Devuelve el próximo partido de Argentina (no jugado) según fecha actual.
 * Si la fase de grupos terminó, retorna null hasta que se cargue manualmente
 * el rival de octavos.
 */
export function proximoPartidoArgentina(now: number = Date.now()): PartidoMundial | null {
  return FIXTURE_ARGENTINA.find(p => new Date(p.kickoffUTC).getTime() > now) ?? null;
}

/**
 * Convierte un timestamp UTC a string legible en hora Israel.
 * Durante el Mundial (junio-julio) Israel está en IDT = UTC+3.
 */
export function formatearHoraIsrael(utcISO: string): string {
  const d = new Date(utcISO);
  // IDT = UTC+3 (junio-julio siempre en IDT)
  const israelMs = d.getTime() + 3 * 60 * 60 * 1000;
  const i = new Date(israelMs);
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const dia = dias[i.getUTCDay()];
  const fecha = `${i.getUTCDate()} ${meses[i.getUTCMonth()]}`;
  const hh = String(i.getUTCHours()).padStart(2, "0");
  const mm = String(i.getUTCMinutes()).padStart(2, "0");
  return `${dia} ${fecha} · ${hh}:${mm} hs`;
}

export function estadioPorId(id: string): EstadioInfo | undefined {
  return ESTADIOS.find(e => e.id === id);
}
