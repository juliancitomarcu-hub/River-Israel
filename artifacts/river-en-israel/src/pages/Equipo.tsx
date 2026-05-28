import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMundialMode } from "@/lib/mundial-mode";
import { SolDeMayo } from "@/components/SolDeMayo";
import { CountdownArgentina } from "@/components/CountdownArgentina";

type PosicionFiltro = "TODOS" | "ARQUEROS" | "DEFENSORES" | "MEDIOCAMPISTAS" | "DELANTEROS";
type PosicionJugador = "ARQUEROS" | "DEFENSORES" | "MEDIOCAMPISTAS" | "DELANTEROS";

interface Jugador {
  numero: number;
  nombre: string;
  apellido: string;
  posicion: PosicionJugador;
  posicionDetalle: string;
  nacionalidad: string;
  bandera: string;
  edad: number;
  foto?: string;
}

const B = "https://www.cariverplate.com.ar/imagenes/jugadores";

const JUGADORES: Jugador[] = [
  // ── ARQUEROS ──
  { numero: 1,  nombre: "Franco",       apellido: "Armani",           posicion: "ARQUEROS",       posicionDetalle: "Arquero",              nacionalidad: "Argentina", bandera: "🇦🇷", edad: 39, foto: `${B}/2025-07/1638-270x360.png` },
  { numero: 33, nombre: "Ezequiel",     apellido: "Centurión",        posicion: "ARQUEROS",       posicionDetalle: "Arquero",              nacionalidad: "Argentina", bandera: "🇦🇷", edad: 22, foto: `${B}/2026-01/310-270x360.png` },
  { numero: 41, nombre: "Santiago",     apellido: "Beltrán",          posicion: "ARQUEROS",       posicionDetalle: "Arquero",              nacionalidad: "Argentina", bandera: "🇦🇷", edad: 21, foto: `${B}/2025-07/1845-270x360.png` },
  // ── DEFENSORES ──
  { numero: 13, nombre: "Lautaro",      apellido: "Rivero",           posicion: "DEFENSORES",     posicionDetalle: "Defensor central",     nacionalidad: "Argentina", bandera: "🇦🇷", edad: 22, foto: `${B}/2025-07/1918-270x360.png` },
  { numero: 16, nombre: "Fabricio",     apellido: "Bustos",           posicion: "DEFENSORES",     posicionDetalle: "Lateral derecho",      nacionalidad: "Argentina", bandera: "🇦🇷", edad: 28, foto: `${B}/2025-07/1886-270x360.png` },
  { numero: 17, nombre: "Paulo",        apellido: "Díaz",             posicion: "DEFENSORES",     posicionDetalle: "Defensor central",     nacionalidad: "Chile",     bandera: "🇨🇱", edad: 28, foto: `${B}/2025-07/1760-270x360.png` },
  { numero: 18, nombre: "Matías",       apellido: "Viña",             posicion: "DEFENSORES",     posicionDetalle: "Lateral izquierdo",    nacionalidad: "Uruguay",   bandera: "🇺🇾", edad: 28, foto: `${B}/2026-01/1929-270x360.png` },
  { numero: 20, nombre: "Germán",       apellido: "Pezzella",         posicion: "DEFENSORES",     posicionDetalle: "Defensor central",     nacionalidad: "Argentina", bandera: "🇦🇷", edad: 34, foto: `${B}/2025-07/1885-270x360.png` },
  { numero: 21, nombre: "Marcos",       apellido: "Acuña",            posicion: "DEFENSORES",     posicionDetalle: "Lateral izquierdo",    nacionalidad: "Argentina", bandera: "🇦🇷", edad: 34, foto: `${B}/2025-07/1888-270x360.png` },
  { numero: 26, nombre: "Ulises",       apellido: "Giménez",          posicion: "DEFENSORES",     posicionDetalle: "Defensor central",     nacionalidad: "Argentina", bandera: "🇦🇷", edad: 20 },
  { numero: 28, nombre: "Lucas",        apellido: "Martínez Quarta",  posicion: "DEFENSORES",     posicionDetalle: "Defensor central",     nacionalidad: "Argentina", bandera: "🇦🇷", edad: 29, foto: `${B}/2025-07/1108-270x360.png` },
  { numero: 29, nombre: "Gonzalo",      apellido: "Montiel",          posicion: "DEFENSORES",     posicionDetalle: "Lateral derecho",      nacionalidad: "Argentina", bandera: "🇦🇷", edad: 29, foto: `${B}/2025-07/1068-270x360.png` },
  // ── MEDIOCAMPISTAS ──
  { numero: 5,  nombre: "Juan Carlos",  apellido: "Portillo",         posicion: "MEDIOCAMPISTAS", posicionDetalle: "Volante central",      nacionalidad: "Honduras",  bandera: "🇭🇳", edad: 28, foto: `${B}/2025-07/1921-270x360.png` },
  { numero: 6,  nombre: "Aníbal",       apellido: "Moreno",           posicion: "MEDIOCAMPISTAS", posicionDetalle: "Volante defensivo",    nacionalidad: "Paraguay",  bandera: "🇵🇾", edad: 26, foto: `${B}/2026-02/1931-270x360.png` },
  { numero: 7,  nombre: "Giuliano",     apellido: "Galoppo",          posicion: "MEDIOCAMPISTAS", posicionDetalle: "Mediocampista",        nacionalidad: "Argentina", bandera: "🇦🇷", edad: 27, foto: `${B}/2025-07/1890-270x360.png` },
  { numero: 8,  nombre: "Maximiliano",  apellido: "Meza",             posicion: "MEDIOCAMPISTAS", posicionDetalle: "Extremo derecho",      nacionalidad: "Argentina", bandera: "🇦🇷", edad: 33, foto: `${B}/2025-07/1887-270x360.png` },
  { numero: 10, nombre: "Juan Fernando",apellido: "Quintero",         posicion: "MEDIOCAMPISTAS", posicionDetalle: "Mediocampista ofensivo",nacionalidad: "Colombia", bandera: "🇨🇴", edad: 33, foto: `${B}/2025-07/1640-270x360.png` },
  { numero: 14, nombre: "Kevin",        apellido: "Castaño",          posicion: "MEDIOCAMPISTAS", posicionDetalle: "Volante central",      nacionalidad: "Colombia",  bandera: "🇨🇴", edad: 28, foto: `${B}/2025-07/1911-270x360.png` },
  { numero: 15, nombre: "Fausto",       apellido: "Vera",             posicion: "MEDIOCAMPISTAS", posicionDetalle: "Mediocampista",        nacionalidad: "Argentina", bandera: "🇦🇷", edad: 24, foto: `${B}/2026-01/1930-270x360.png` },
  { numero: 22, nombre: "Tomás",        apellido: "Galván",           posicion: "MEDIOCAMPISTAS", posicionDetalle: "Mediocampista",        nacionalidad: "Argentina", bandera: "🇦🇷", edad: 21, foto: `${B}/2026-01/1823-270x360.png` },
  { numero: 23, nombre: "Ian",          apellido: "Subiabre",         posicion: "MEDIOCAMPISTAS", posicionDetalle: "Mediocampista ofensivo",nacionalidad: "Argentina", bandera: "🇦🇷", edad: 20, foto: `${B}/2025-07/1847-270x360.png` },
  { numero: 24, nombre: "Kendry",       apellido: "Páez",             posicion: "MEDIOCAMPISTAS", posicionDetalle: "Mediocampista",        nacionalidad: "Ecuador",   bandera: "🇪🇨", edad: 19 },
  { numero: 30, nombre: "Santiago",     apellido: "Lencina",          posicion: "MEDIOCAMPISTAS", posicionDetalle: "Extremo izquierdo",    nacionalidad: "Argentina", bandera: "🇦🇷", edad: 23, foto: `${B}/2025-07/1912-270x360.png` },
  // ── DELANTEROS ──
  { numero: 9,  nombre: "Sebastián",    apellido: "Driussi",          posicion: "DELANTEROS",     posicionDetalle: "Delantero centro",     nacionalidad: "Argentina", bandera: "🇦🇷", edad: 29, foto: `${B}/2025-07/1893-270x360.png` },
  { numero: 11, nombre: "Maximiliano",  apellido: "Salas",            posicion: "DELANTEROS",     posicionDetalle: "Delantero centro",     nacionalidad: "Argentina", bandera: "🇦🇷", edad: 31, foto: `${B}/2025-07/1915-270x360.png` },
  { numero: 19, nombre: "Facundo",      apellido: "Colidio",          posicion: "DELANTEROS",     posicionDetalle: "Extremo derecho",      nacionalidad: "Argentina", bandera: "🇦🇷", edad: 25, foto: `${B}/2025-07/1842-270x360.png` },
  { numero: 27, nombre: "Joaquín",      apellido: "Freitas",          posicion: "DELANTEROS",     posicionDetalle: "Delantero",            nacionalidad: "Argentina", bandera: "🇦🇷", edad: 20, foto: `${B}/2026-02/1936-270x360.png` },
];

const ORDEN_POSICION: Record<PosicionJugador, number> = {
  ARQUEROS: 0, DEFENSORES: 1, MEDIOCAMPISTAS: 2, DELANTEROS: 3,
};

const LABEL_POSICION: Record<PosicionJugador, string> = {
  ARQUEROS: "Arqueros", DEFENSORES: "Defensores",
  MEDIOCAMPISTAS: "Mediocampistas", DELANTEROS: "Delanteros",
};

const FILTROS: { label: string; value: PosicionFiltro }[] = [
  { label: "Todos", value: "TODOS" },
  { label: "Arqueros", value: "ARQUEROS" },
  { label: "Defensores", value: "DEFENSORES" },
  { label: "Mediocampistas", value: "MEDIOCAMPISTAS" },
  { label: "Delanteros", value: "DELANTEROS" },
];

function PlayerCard({ jugador, index }: { jugador: Jugador; index: number }) {
  const [flipped, setFlipped] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25, delay: index * 0.025 }}
      style={{ aspectRatio: "3/4", perspective: "1000px" }}
      className="cursor-pointer"
      onClick={() => setFlipped(!flipped)}
    >
      <div
        className="relative w-full h-full transition-transform duration-500"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* ── FRENTE ── */}
        <div
          className="absolute inset-0 rounded-lg overflow-hidden bg-white/5 group"
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-river-red/70 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 z-10" />

          {jugador.foto && !imgError ? (
            <img
              src={jugador.foto}
              alt={`${jugador.nombre} ${jugador.apellido}`}
              className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-500"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-white/5 to-black/20">
              <span className="text-7xl font-display font-black text-white/10 select-none leading-none">
                {jugador.numero}
              </span>
              <span className="text-4xl mt-4">{jugador.bandera}</span>
            </div>
          )}

          <div className="absolute top-3 left-3 z-20">
            <span className="text-white/25 font-display font-black text-4xl leading-none hover:text-white/50 transition-colors">
              {jugador.numero}
            </span>
          </div>

          <div className="absolute bottom-0 left-0 right-0 z-20 p-3 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
            <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest">{jugador.nombre}</p>
            <p className="text-white font-display font-bold text-base leading-tight uppercase">{jugador.apellido}</p>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-river-red scale-x-0 hover:scale-x-100 transition-transform duration-300 z-30 origin-left" />

          {/* Hint de click */}
          <div className="absolute top-2 right-2 z-20 bg-white/10 rounded-full p-1 opacity-60">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
            </svg>
          </div>
        </div>

        {/* ── DORSO (info) ── */}
        <div
          className="absolute inset-0 rounded-lg overflow-hidden bg-[#0a0a12] border border-white/10 flex flex-col p-4"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          {/* Franja roja superior */}
          <div className="h-1 w-12 bg-river-red mb-3 rounded-full" />

          <p className="text-white/50 text-[10px] font-bold uppercase tracking-[0.2em] leading-none">
            {jugador.nombre}
          </p>
          <div className="flex items-end gap-2 mt-1">
            <p className="text-white font-display font-black text-xl leading-tight uppercase">
              {jugador.apellido}
            </p>
            <p className="text-river-red font-display font-black text-xl leading-tight mb-0.5">
              {jugador.numero}
            </p>
          </div>

          <div className="h-px bg-white/10 my-3" />

          <div className="flex flex-col gap-3 flex-1">
            <div>
              <p className="text-white/30 text-[9px] uppercase tracking-widest mb-0.5">Nacionalidad</p>
              <p className="text-white font-semibold text-sm flex items-center gap-1.5">
                <span>{jugador.bandera}</span>
                {jugador.nacionalidad}
              </p>
            </div>
            <div>
              <p className="text-white/30 text-[9px] uppercase tracking-widest mb-0.5">Posición</p>
              <p className="text-white font-semibold text-sm">{jugador.posicionDetalle}</p>
            </div>
            <div>
              <p className="text-white/30 text-[9px] uppercase tracking-widest mb-0.5">Edad</p>
              <p className="text-white font-black text-2xl font-display">{jugador.edad}</p>
            </div>
          </div>

          <div className="mt-auto pt-2 border-t border-white/10">
            <p className="text-white/20 text-[9px] uppercase tracking-widest text-center">
              Toca para volver
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CoudetCard() {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="cursor-pointer"
      style={{ aspectRatio: "3/4", perspective: "1000px" }}
      onClick={() => setFlipped(!flipped)}
    >
      <div
        className="relative w-full h-full transition-transform duration-500"
        style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        {/* Frente */}
        <div
          className="absolute inset-0 rounded-lg overflow-hidden group"
          style={{ backfaceVisibility: "hidden" }}
        >
          <img
            src="/images/coudet.jpeg"
            alt="Eduardo Coudet"
            className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-river-red/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
            <p className="text-river-red text-[10px] font-bold uppercase tracking-widest">Director Técnico</p>
            <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest">Eduardo "Chacho"</p>
            <p className="text-white font-display font-bold text-base uppercase">Coudet</p>
          </div>
          <div className="absolute top-2 right-2 bg-river-red/20 border border-river-red/40 rounded-full px-2 py-0.5">
            <span className="text-river-red text-[9px] font-bold uppercase tracking-widest">DT</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-river-red scale-x-0 hover:scale-x-100 transition-transform duration-300 z-30 origin-left" />
        </div>

        {/* Dorso */}
        <div
          className="absolute inset-0 rounded-lg overflow-hidden bg-[#0a0a12] border border-river-red/30 flex flex-col p-4"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="h-1 w-12 bg-river-red mb-3 rounded-full" />
          <p className="text-river-red text-[10px] font-bold uppercase tracking-[0.2em]">Director Técnico</p>
          <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mt-1">Eduardo "Chacho"</p>
          <p className="text-white font-display font-black text-xl uppercase">Coudet</p>

          <div className="h-px bg-white/10 my-3" />
          <div className="flex flex-col gap-3 flex-1">
            <div>
              <p className="text-white/30 text-[9px] uppercase tracking-widest mb-0.5">Nacionalidad</p>
              <p className="text-white font-semibold text-sm flex items-center gap-1.5">🇦🇷 Argentina</p>
            </div>
            <div>
              <p className="text-white/30 text-[9px] uppercase tracking-widest mb-0.5">Cargo</p>
              <p className="text-white font-semibold text-sm">Entrenador principal</p>
            </div>
            <div>
              <p className="text-white/30 text-[9px] uppercase tracking-widest mb-0.5">Edad</p>
              <p className="text-white font-black text-2xl font-display">48</p>
            </div>
          </div>
          <div className="mt-auto pt-2 border-t border-white/10">
            <p className="text-white/20 text-[9px] uppercase tracking-widest text-center">Toca para volver</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Equipo() {
  const mundialActivo = useMundialMode();
  const [filtro, setFiltro] = useState<PosicionFiltro>("TODOS");

  if (mundialActivo) {
    return (
      <div className="min-h-screen bg-mundial-mesh text-white pt-28 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-6">
            <SolDeMayo size={120} spin />
          </div>
          <span className="inline-flex items-center gap-2 bg-arg-dorado/95 text-[#0a1628] text-[10px] md:text-xs font-bold uppercase tracking-[0.22em] px-4 py-1.5 rounded-full mb-5 shadow-lg shadow-arg-dorado/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0a1628] animate-pulse" />
            Plantel oficial · Mundial 2026
          </span>
          <h1 className="text-4xl md:text-6xl font-display font-black mb-4 leading-tight text-shadow-cinema">
            ESPERANDO LA LISTA <br />
            <span className="text-arg-celeste">DE SCALONI</span>
          </h1>
          <p className="text-white/75 text-base md:text-lg max-w-xl mx-auto leading-relaxed mb-8">
            El cuerpo técnico está terminando de definir los 26 convocados que defenderán
            la corona en USA / Canadá / México. Apenas se publique la lista oficial, la vas
            a ver acá con foto, dorsal, club y todo lo que necesitás saber.
          </p>
          <div className="bg-white/5 border border-arg-celeste/30 rounded-2xl p-6 md:p-8 backdrop-blur-sm mb-8">
            <p className="text-arg-dorado font-bold text-xs uppercase tracking-widest mb-4">
              Mientras tanto, contemos juntos al debut
            </p>
            <CountdownArgentina />
          </div>
          <p className="text-white/40 text-xs">
            DT: Lionel Scaloni · Núcleo del plantel campeón Qatar 2022 + bicampeón Copa América 2024
          </p>
        </div>
      </div>
    );
  }

  const jugadoresFiltrados =
    filtro === "TODOS"
      ? [...JUGADORES].sort(
          (a, b) =>
            ORDEN_POSICION[a.posicion] - ORDEN_POSICION[b.posicion] ||
            a.numero - b.numero
        )
      : JUGADORES.filter((j) => j.posicion === filtro).sort(
          (a, b) => a.numero - b.numero
        );

  const grupos = filtro === "TODOS"
    ? (["ARQUEROS", "DEFENSORES", "MEDIOCAMPISTAS", "DELANTEROS"] as PosicionJugador[]).map((pos) => ({
        posicion: pos,
        jugadores: jugadoresFiltrados.filter((j) => j.posicion === pos),
      }))
    : null;

  return (
    <div className="min-h-screen bg-river-black">
      {/* Hero */}
      <div
        className="relative pt-32 pb-16 px-4 overflow-hidden"
        style={{
          backgroundImage: "url('/images/hero-monumental.png?v=2')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-river-black/70 via-river-black/60 to-river-black" />
        <div className="relative z-10 max-w-7xl mx-auto text-center">
          <p className="text-river-red font-bold uppercase tracking-[0.3em] text-sm mb-3">
            Club Atlético River Plate
          </p>
          <h1 className="font-display font-black text-5xl md:text-7xl text-white uppercase leading-none tracking-tight">
            Plantilla
            <span className="block text-river-red">Profesional</span>
          </h1>
          <p className="text-white/50 text-lg mt-4 font-medium">
            Temporada 2026 · DT Eduardo Coudet
          </p>
          <p className="text-white/30 text-sm mt-2">Tocá cada jugador para ver su información</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="sticky top-16 z-40 bg-river-black/95 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-none">
            {FILTROS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFiltro(f.value)}
                className={`relative px-5 py-4 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors duration-200 ${
                  filtro === f.value ? "text-white" : "text-white/40 hover:text-white/70"
                }`}
              >
                {f.label}
                {filtro === f.value && (
                  <motion.div
                    layoutId="filtro-underline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-river-red"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
            <div className="ml-auto pl-4 flex-shrink-0 text-white/30 text-xs py-4 hidden md:block">
              {jugadoresFiltrados.length} jugadores
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 pt-10 pb-6">
        <AnimatePresence mode="wait">
          {grupos ? (
            /* TODOS: agrupado por posición */
            <motion.div
              key="grupos"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {grupos.map(({ posicion, jugadores }) => (
                <div key={posicion} className="mb-12">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-1 h-6 bg-river-red rounded-full" />
                    <h2 className="text-white/80 font-display font-bold text-lg uppercase tracking-widest">
                      {LABEL_POSICION[posicion]}
                    </h2>
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-white/30 text-xs">{jugadores.length}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
                    {jugadores.map((jugador, i) => (
                      <PlayerCard key={jugador.numero} jugador={jugador} index={i} />
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          ) : (
            /* Filtro individual */
            <motion.div
              key={filtro}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4"
            >
              {jugadoresFiltrados.map((jugador, i) => (
                <PlayerCard key={jugador.numero} jugador={jugador} index={i} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── CUERPO TÉCNICO ── */}
      <div className="max-w-7xl mx-auto px-4 pb-16 mt-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-1 h-6 bg-river-red rounded-full" />
          <h2 className="text-white/80 font-display font-bold text-lg uppercase tracking-widest">
            Director Técnico
          </h2>
          <div className="flex-1 h-px bg-white/10" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
          <CoudetCard />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-10 text-center">
        <p className="text-white/20 text-xs">
          Datos actualizados al 29 de marzo de 2026 · Fuente: cariverplate.com.ar
        </p>
      </div>
    </div>
  );
}
