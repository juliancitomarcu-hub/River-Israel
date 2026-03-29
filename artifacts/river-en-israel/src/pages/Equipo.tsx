import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Posicion = "TODOS" | "ARQUEROS" | "DEFENSORES" | "MEDIOCAMPISTAS" | "DELANTEROS";

interface Jugador {
  numero: number;
  nombre: string;
  apellido: string;
  posicion: Posicion;
  nacionalidad: string;
  bandera: string;
  foto?: string;
}

const BASE_IMG = "https://www.cariverplate.com.ar/imagenes/jugadores";

const JUGADORES: Jugador[] = [
  // ARQUEROS
  {
    numero: 1, nombre: "Franco", apellido: "Armani",
    posicion: "ARQUEROS", nacionalidad: "Argentina", bandera: "🇦🇷",
    foto: `${BASE_IMG}/2025-07/1638-270x360.png`,
  },
  {
    numero: 33, nombre: "Ezequiel", apellido: "Centurión",
    posicion: "ARQUEROS", nacionalidad: "Argentina", bandera: "🇦🇷",
    foto: `${BASE_IMG}/2026-01/310-270x360.png`,
  },
  {
    numero: 41, nombre: "Santiago", apellido: "Beltrán",
    posicion: "ARQUEROS", nacionalidad: "Argentina", bandera: "🇦🇷",
    foto: `${BASE_IMG}/2025-07/1845-270x360.png`,
  },
  // DEFENSORES
  {
    numero: 13, nombre: "Lautaro", apellido: "Rivero",
    posicion: "DEFENSORES", nacionalidad: "Argentina", bandera: "🇦🇷",
    foto: `${BASE_IMG}/2025-07/1918-270x360.png`,
  },
  {
    numero: 16, nombre: "Fabricio", apellido: "Bustos",
    posicion: "DEFENSORES", nacionalidad: "Argentina", bandera: "🇦🇷",
    foto: `${BASE_IMG}/2025-07/1886-270x360.png`,
  },
  {
    numero: 17, nombre: "Paulo", apellido: "Díaz",
    posicion: "DEFENSORES", nacionalidad: "Chile", bandera: "🇨🇱",
    foto: `${BASE_IMG}/2025-07/1760-270x360.png`,
  },
  {
    numero: 18, nombre: "Matías", apellido: "Viña",
    posicion: "DEFENSORES", nacionalidad: "Uruguay", bandera: "🇺🇾",
    foto: `${BASE_IMG}/2026-01/1929-270x360.png`,
  },
  {
    numero: 20, nombre: "Germán", apellido: "Pezzella",
    posicion: "DEFENSORES", nacionalidad: "Argentina", bandera: "🇦🇷",
    foto: `${BASE_IMG}/2025-07/1885-270x360.png`,
  },
  {
    numero: 21, nombre: "Marcos", apellido: "Acuña",
    posicion: "DEFENSORES", nacionalidad: "Argentina", bandera: "🇦🇷",
    foto: `${BASE_IMG}/2025-07/1888-270x360.png`,
  },
  {
    numero: 28, nombre: "Lucas", apellido: "Martínez Quarta",
    posicion: "DEFENSORES", nacionalidad: "Argentina", bandera: "🇦🇷",
    foto: `${BASE_IMG}/2025-07/1108-270x360.png`,
  },
  {
    numero: 29, nombre: "Gonzalo", apellido: "Montiel",
    posicion: "DEFENSORES", nacionalidad: "Argentina", bandera: "🇦🇷",
    foto: `${BASE_IMG}/2025-07/1068-270x360.png`,
  },
  {
    numero: 26, nombre: "Ulises", apellido: "Giménez",
    posicion: "DEFENSORES", nacionalidad: "Argentina", bandera: "🇦🇷",
  },
  // MEDIOCAMPISTAS
  {
    numero: 5, nombre: "Juan Carlos", apellido: "Portillo",
    posicion: "MEDIOCAMPISTAS", nacionalidad: "Honduras", bandera: "🇭🇳",
    foto: `${BASE_IMG}/2025-07/1921-270x360.png`,
  },
  {
    numero: 6, nombre: "Aníbal", apellido: "Moreno",
    posicion: "MEDIOCAMPISTAS", nacionalidad: "Paraguay", bandera: "🇵🇾",
    foto: `${BASE_IMG}/2026-02/1931-270x360.png`,
  },
  {
    numero: 7, nombre: "Giuliano", apellido: "Galoppo",
    posicion: "MEDIOCAMPISTAS", nacionalidad: "Argentina", bandera: "🇦🇷",
  },
  {
    numero: 8, nombre: "Maximiliano", apellido: "Meza",
    posicion: "MEDIOCAMPISTAS", nacionalidad: "Argentina", bandera: "🇦🇷",
    foto: `${BASE_IMG}/2025-07/1887-270x360.png`,
  },
  {
    numero: 10, nombre: "Juan Fernando", apellido: "Quintero",
    posicion: "MEDIOCAMPISTAS", nacionalidad: "Colombia", bandera: "🇨🇴",
    foto: `${BASE_IMG}/2025-07/1640-270x360.png`,
  },
  {
    numero: 14, nombre: "Kevin", apellido: "Castaño",
    posicion: "MEDIOCAMPISTAS", nacionalidad: "Colombia", bandera: "🇨🇴",
  },
  {
    numero: 15, nombre: "Fausto", apellido: "Vera",
    posicion: "MEDIOCAMPISTAS", nacionalidad: "Argentina", bandera: "🇦🇷",
    foto: `${BASE_IMG}/2026-01/1930-270x360.png`,
  },
  {
    numero: 22, nombre: "Tomás", apellido: "Galván",
    posicion: "MEDIOCAMPISTAS", nacionalidad: "Argentina", bandera: "🇦🇷",
  },
  {
    numero: 23, nombre: "Ian", apellido: "Subiabre",
    posicion: "MEDIOCAMPISTAS", nacionalidad: "Argentina", bandera: "🇦🇷",
  },
  {
    numero: 24, nombre: "Kendry", apellido: "Páez",
    posicion: "MEDIOCAMPISTAS", nacionalidad: "Ecuador", bandera: "🇪🇨",
  },
  {
    numero: 30, nombre: "Santiago", apellido: "Lencina",
    posicion: "MEDIOCAMPISTAS", nacionalidad: "Argentina", bandera: "🇦🇷",
  },
  // DELANTEROS
  {
    numero: 9, nombre: "Sebastián", apellido: "Driussi",
    posicion: "DELANTEROS", nacionalidad: "Argentina", bandera: "🇦🇷",
  },
  {
    numero: 11, nombre: "Maximiliano", apellido: "Salas",
    posicion: "DELANTEROS", nacionalidad: "Argentina", bandera: "🇦🇷",
  },
  {
    numero: 19, nombre: "Facundo", apellido: "Colidio",
    posicion: "DELANTEROS", nacionalidad: "Argentina", bandera: "🇦🇷",
  },
  {
    numero: 27, nombre: "Joaquín", apellido: "Freitas",
    posicion: "DELANTEROS", nacionalidad: "Argentina", bandera: "🇦🇷",
  },
];

const FILTROS: { label: string; value: Posicion }[] = [
  { label: "Todos", value: "TODOS" },
  { label: "Arqueros", value: "ARQUEROS" },
  { label: "Defensores", value: "DEFENSORES" },
  { label: "Mediocampistas", value: "MEDIOCAMPISTAS" },
  { label: "Delanteros", value: "DELANTEROS" },
];

function PlayerCard({ jugador, index }: { jugador: Jugador; index: number }) {
  const [imgError, setImgError] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      className="group relative overflow-hidden rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-300 cursor-pointer"
      style={{ aspectRatio: "3/4" }}
    >
      {/* Fondo degradado rojo al hacer hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-river-red/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10" />

      {/* Foto o placeholder */}
      {jugador.foto && !imgError ? (
        <img
          src={jugador.foto}
          alt={`${jugador.nombre} ${jugador.apellido}`}
          className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-white/5 to-white/0">
          <span className="text-6xl font-display font-black text-white/10 select-none">
            {jugador.numero}
          </span>
          <div className="mt-4 w-16 h-16 rounded-full border-2 border-white/20 flex items-center justify-center">
            <span className="text-2xl">{jugador.bandera}</span>
          </div>
        </div>
      )}

      {/* Número flotante */}
      <div className="absolute top-3 left-4 z-20">
        <span className="text-white/30 font-display font-black text-4xl leading-none group-hover:text-white/60 transition-colors duration-300">
          {jugador.numero}
        </span>
      </div>

      {/* Info abajo */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
        <p className="text-white/70 text-xs font-medium uppercase tracking-widest mb-0.5">
          {jugador.nombre}
        </p>
        <p className="text-white font-display font-bold text-lg leading-tight uppercase tracking-wide">
          {jugador.apellido}
        </p>
        <div className="flex items-center gap-2 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span className="text-sm">{jugador.bandera}</span>
          <span className="text-white/60 text-xs">{jugador.nacionalidad}</span>
        </div>
      </div>

      {/* Borde rojo inferior al hover */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-river-red scale-x-0 group-hover:scale-x-100 transition-transform duration-300 z-30 origin-left" />
    </motion.div>
  );
}

export default function Equipo() {
  const [filtro, setFiltro] = useState<Posicion>("TODOS");

  const jugadoresFiltrados = filtro === "TODOS"
    ? JUGADORES
    : JUGADORES.filter((j) => j.posicion === filtro);

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
                className={`
                  relative px-6 py-4 text-sm font-bold uppercase tracking-widest whitespace-nowrap transition-colors duration-200
                  ${filtro === f.value
                    ? "text-white"
                    : "text-white/40 hover:text-white/70"
                  }
                `}
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
            <div className="ml-auto pl-4 flex-shrink-0 text-white/30 text-sm py-4 hidden md:block">
              {jugadoresFiltrados.length} jugadores
            </div>
          </div>
        </div>
      </div>

      {/* Grid de jugadores */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={filtro}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4"
          >
            {jugadoresFiltrados
              .sort((a, b) => a.numero - b.numero)
              .map((jugador, i) => (
                <PlayerCard key={jugador.numero} jugador={jugador} index={i} />
              ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer info */}
      <div className="max-w-7xl mx-auto px-4 pb-16 text-center">
        <p className="text-white/20 text-sm">
          Datos actualizados al 29 de marzo de 2026 · Fuente: cariverplate.com.ar
        </p>
      </div>
    </div>
  );
}
