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
  { id: "azteca",       nombre: "Estadio Azteca",          ciudad: "Ciudad de México", pais: "México", capacidad: 87000, inaugurado: 1966, lat: 19.3029, lng: -99.1505, detalles: "Sede del partido inaugural el 11/06/26. Único estadio que albergó tres Mundiales (1970, 1986, 2026). Aquí Maradona hizo el gol del siglo.", imagen: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Estadio_Azteca_2.JPG/640px-Estadio_Azteca_2.JPG" },
  { id: "metlife",      nombre: "MetLife Stadium",         ciudad: "Nueva York / Nueva Jersey", pais: "USA", capacidad: 82500, inaugurado: 2010, lat: 40.8136, lng: -74.0744, detalles: "Sede de la FINAL el 19/07/26. Hogar de los New York Giants y Jets.", imagen: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/MetLife_Stadium_%28September_2014%29.jpg/640px-MetLife_Stadium_%28September_2014%29.jpg" },
  { id: "att",          nombre: "AT&T Stadium",            ciudad: "Dallas",            pais: "USA", capacidad: 80000, inaugurado: 2009, lat: 32.7473, lng: -97.0945, detalles: "Hogar de los Dallas Cowboys. Será sede de una semifinal.", imagen: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Cowboys_Stadium_full_view.jpg/640px-Cowboys_Stadium_full_view.jpg" },
  { id: "sofi",         nombre: "SoFi Stadium",            ciudad: "Los Ángeles",       pais: "USA", capacidad: 70000, inaugurado: 2020, lat: 33.9534, lng: -118.3387, detalles: "Estadio futurista techado. Hogar de Rams y Chargers.", imagen: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/SoFi_Stadium_aerial.jpg/640px-SoFi_Stadium_aerial.jpg" },
  { id: "mercedes",     nombre: "Mercedes-Benz Stadium",   ciudad: "Atlanta",           pais: "USA", capacidad: 71000, inaugurado: 2017, lat: 33.7553, lng: -84.4006, detalles: "Techo retráctil con apertura en pétalos. Sede de otra semifinal.", imagen: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Mercedes-Benz_Stadium_%2829418248715%29.jpg/640px-Mercedes-Benz_Stadium_%2829418248715%29.jpg" },
  { id: "arrowhead",    nombre: "Arrowhead Stadium",       ciudad: "Kansas City",       pais: "USA", capacidad: 76000, inaugurado: 1972, lat: 39.0489, lng: -94.4839, detalles: "El estadio más ruidoso del mundo según Guinness.", imagen: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Arrowhead_Stadium_aerial-edit.jpg/640px-Arrowhead_Stadium_aerial-edit.jpg" },
  { id: "lincoln",      nombre: "Lincoln Financial Field", ciudad: "Filadelfia",        pais: "USA", capacidad: 69000, inaugurado: 2003, lat: 39.9008, lng: -75.1675, detalles: "Hogar de los Philadelphia Eagles.", imagen: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Lincoln_Financial_Field_Philly.jpg/640px-Lincoln_Financial_Field_Philly.jpg" },
  { id: "gillette",     nombre: "Gillette Stadium",        ciudad: "Boston",            pais: "USA", capacidad: 65000, inaugurado: 2002, lat: 42.0909, lng: -71.2643, detalles: "Hogar de los New England Patriots.", imagen: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Gillette_Stadium_field_view.jpg/640px-Gillette_Stadium_field_view.jpg" },
  { id: "hardrock",     nombre: "Hard Rock Stadium",       ciudad: "Miami",             pais: "USA", capacidad: 65000, inaugurado: 1987, lat: 25.9580, lng: -80.2389, detalles: "Sede del partido por el TERCER PUESTO.", imagen: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Hard_Rock_Stadium_aerial_view.jpg/640px-Hard_Rock_Stadium_aerial_view.jpg" },
  { id: "nrg",          nombre: "NRG Stadium",             ciudad: "Houston",           pais: "USA", capacidad: 72000, inaugurado: 2002, lat: 29.6847, lng: -95.4107, detalles: "Estadio techado con clima controlado.", imagen: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Reliant_Stadium.jpg/640px-Reliant_Stadium.jpg" },
  { id: "levis",        nombre: "Levi's Stadium",          ciudad: "San Francisco Bay", pais: "USA", capacidad: 69000, inaugurado: 2014, lat: 37.4030, lng: -121.9700, detalles: "Hogar de los San Francisco 49ers.", imagen: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Levi%27s_Stadium_field_view.jpg/640px-Levi%27s_Stadium_field_view.jpg" },
  { id: "lumen",        nombre: "Lumen Field",             ciudad: "Seattle",           pais: "USA", capacidad: 69000, inaugurado: 2002, lat: 47.5952, lng: -122.3316, detalles: "Hogar de los Seattle Seahawks.", imagen: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Lumen_Field_2020.jpg/640px-Lumen_Field_2020.jpg" },
  { id: "bmo",          nombre: "BMO Field",               ciudad: "Toronto",           pais: "Canadá", capacidad: 45000, inaugurado: 2007, lat: 43.6332, lng: -79.4185, detalles: "Hogar del Toronto FC. Ampliado para el Mundial.", imagen: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/BMO_Field_Toronto_Football_Club_panorama.jpg/640px-BMO_Field_Toronto_Football_Club_panorama.jpg" },
  { id: "bcplace",      nombre: "BC Place",                ciudad: "Vancouver",         pais: "Canadá", capacidad: 54000, inaugurado: 1983, lat: 49.2767, lng: -123.1119, detalles: "Estadio con techo retráctil sobre el Pacífico.", imagen: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/BC_Place_Stadium_Vancouver_panorama_2.jpg/640px-BC_Place_Stadium_Vancouver_panorama_2.jpg" },
  { id: "akron",        nombre: "Estadio Akron",           ciudad: "Guadalajara",       pais: "México", capacidad: 49000, inaugurado: 2010, lat: 20.6818, lng: -103.4625, detalles: "Hogar de Chivas de Guadalajara.", imagen: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Estadio_Akron_Chivas.jpg/640px-Estadio_Akron_Chivas.jpg" },
  { id: "bbva",         nombre: "Estadio BBVA",            ciudad: "Monterrey",         pais: "México", capacidad: 53000, inaugurado: 2015, lat: 25.6692, lng: -100.2444, detalles: "Hogar de Rayados de Monterrey. Vista al Cerro de la Silla.", imagen: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Estadio_BBVA_Bancomer_Rayados.jpg/640px-Estadio_BBVA_Bancomer_Rayados.jpg" },
];

// ──────────────────────────────────────────────────────────────
// FIGURAS DE LA SCALONETA — núcleo del plantel campeón
// ──────────────────────────────────────────────────────────────

export type FiguraScaloneta = {
  dorsal: number;
  nombre: string;
  apellido: string;
  posicion: "DT" | "Arquero" | "Defensor" | "Mediocampista" | "Delantero";
  club: string;
  apodo?: string;
  esCapitan?: boolean;
  foto?: string;
};

/**
 * Fotos: campo `foto` opcional. Cuando no hay URL, el render muestra el dorsal grande
 * sobre el Sol de Mayo (fallback elegante). Las URLs de Wikipedia thumbs son inestables
 * (404/429), así que sólo dejamos Messi verificado; el resto se sube desde el admin.
 *
 * Para agregar fotos: subirlas via /redactor (tab Galería) y pegar la URL en este array.
 */
const wp = (file: string) => `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=400`;

export const JUGADORES_SCALONETA: FiguraScaloneta[] = [
  { dorsal: 10, nombre: "Lionel", apellido: "Messi",          posicion: "Delantero",     club: "Inter Miami",        apodo: "La Pulga · El GOAT", esCapitan: true,
    foto: wp("Lionel_Messi_20180626.jpg") },
  { dorsal: 23, nombre: "Emiliano", apellido: "Martínez",     posicion: "Arquero",       club: "Aston Villa",        apodo: "Dibu",
    foto: wp("Emiliano_Mart%C3%ADnez_2022.jpg") },
  { dorsal: 7,  nombre: "Rodrigo", apellido: "De Paul",       posicion: "Mediocampista", club: "Atlético Madrid",    apodo: "Motorcito",
    foto: wp("Rodrigo_De_Paul_2018.jpg") },
  { dorsal: 9,  nombre: "Julián", apellido: "Álvarez",        posicion: "Delantero",     club: "Atlético Madrid",    apodo: "La Araña",
    foto: wp("Juli%C3%A1n_%C3%81lvarez_2022.jpg") },
  { dorsal: 22, nombre: "Lautaro", apellido: "Martínez",      posicion: "Delantero",     club: "Inter Milán",        apodo: "El Toro",
    foto: wp("Lautaro_Mart%C3%ADnez_2022.jpg") },
  { dorsal: 24, nombre: "Enzo", apellido: "Fernández",        posicion: "Mediocampista", club: "Chelsea",            apodo: "Enzo",
    foto: wp("Enzo_Fern%C3%A1ndez_2022.jpg") },
  { dorsal: 20, nombre: "Alexis", apellido: "Mac Allister",   posicion: "Mediocampista", club: "Liverpool",          apodo: "Colo",
    foto: wp("Alexis_Mac_Allister_2022.jpg") },
  { dorsal: 13, nombre: "Cristian", apellido: "Romero",       posicion: "Defensor",      club: "Tottenham",          apodo: "Cuti",
    foto: wp("Cristian_Romero_2021.jpg") },
  { dorsal: 26, nombre: "Nahuel", apellido: "Molina",         posicion: "Defensor",      club: "Atlético Madrid",
    foto: wp("Nahuel_Molina_2022.jpg") },
  { dorsal: 3,  nombre: "Nicolás", apellido: "Tagliafico",    posicion: "Defensor",      club: "Olympique Lyon",
    foto: wp("Nicol%C3%A1s_Tagliafico_2018.jpg") },
  { dorsal: 19, nombre: "Nicolás", apellido: "Otamendi",      posicion: "Defensor",      club: "Benfica",            apodo: "El General",
    foto: wp("Nicol%C3%A1s_Otamendi_2018.jpg") },
  { dorsal: 11, nombre: "Ángel", apellido: "Di María",        posicion: "Delantero",     club: "Rosario Central",    apodo: "Fideo · Leyenda",
    foto: wp("%C3%81ngel_Di_Mar%C3%ADa_2018.jpg") },
  { dorsal: 0,  nombre: "Lionel", apellido: "Scaloni",        posicion: "DT",            club: "Selección Argentina", apodo: "El estratega",
    foto: wp("Lionel_Scaloni_2018.jpg") },
];

// ──────────────────────────────────────────────────────────────
// HISTORIA DE LA SELECCIÓN ARGENTINA — hitos clave
// ──────────────────────────────────────────────────────────────

export type HitoSeleccion = {
  año: number;
  titulo: string;
  descripcion: string;
  copa?: string;
  emoji?: string;
  destacado?: boolean;
};

export const HITOS_SELECCION: HitoSeleccion[] = [
  { año: 1893, titulo: "Nace la AFA",
    descripcion: "Se funda la Asociación del Fútbol Argentino, una de las más antiguas del mundo.",
    emoji: "📜" },
  { año: 1978, titulo: "Primer Mundial",
    descripcion: "Argentina campeón del mundo en casa, dirigida por César Luis Menotti. Goleada 3-1 a Holanda en la final.",
    copa: "Mundial 🏆", destacado: true, emoji: "⭐" },
  { año: 1986, titulo: "La Mano y el Gol del Siglo",
    descripcion: "Diego Armando Maradona lleva a Argentina al segundo Mundial. La obra de arte ante Inglaterra queda grabada en la historia.",
    copa: "Mundial 🏆", destacado: true, emoji: "⭐⭐" },
  { año: 1993, titulo: "Copa América",
    descripcion: "Última gloria del siglo XX: Argentina campeón en Ecuador. Pasarían 28 años hasta el próximo título.",
    copa: "Copa América", emoji: "🥇" },
  { año: 2014, titulo: "Final en Maracaná",
    descripcion: "Messi y compañía pierden la final del Mundial ante Alemania en tiempo extra. La final más cerca y más lejos a la vez.",
    emoji: "💔" },
  { año: 2021, titulo: "Maracanazo de la Scaloneta",
    descripcion: "Argentina rompe la sequía: campeón de la Copa América en el Maracaná, ante Brasil. Comienza la era Scaloneta.",
    copa: "Copa América 🏆", destacado: true, emoji: "🎉" },
  { año: 2022, titulo: "TRICAMPEONES DEL MUNDO",
    descripcion: "En Qatar, Argentina conquista la tercera estrella derrotando a Francia por penales tras un 3-3 épico. Messi alza la copa.",
    copa: "Mundial 🏆🏆🏆", destacado: true, emoji: "🌟" },
  { año: 2024, titulo: "Bicampeón de América",
    descripcion: "Argentina retiene la Copa América venciendo a Colombia en la final disputada en el Hard Rock Stadium de Miami.",
    copa: "Copa América 🏆", destacado: true, emoji: "🏆" },
  { año: 2026, titulo: "DEFENDER LA CORONA",
    descripcion: "Argentina llega al Mundial USA/Canadá/México como defensora del título, con Scaloni y el núcleo campeón. La Scaloneta va por más.",
    emoji: "🇦🇷", destacado: true },
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
