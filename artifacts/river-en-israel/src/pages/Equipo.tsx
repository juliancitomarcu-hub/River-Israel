import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getGetPlantelQueryKey,
  useGetPlantel,
  type JugadorPlantel,
} from "@workspace/api-client-react";
import { useMundialMode } from "@/lib/mundial-mode";
import { SolDeMayo } from "@/components/SolDeMayo";
import { CountdownArgentina } from "@/components/CountdownArgentina";

type PosicionFiltro = "TODOS" | JugadorPlantel["posicion"];
type PosicionJugador = JugadorPlantel["posicion"];
type Jugador = JugadorPlantel;

const ORDEN_POSICION: Record<PosicionJugador, number> = {
  ARQ: 0,
  DEF: 1,
  MED: 2,
  DEL: 3,
};

const LABEL_POSICION: Record<PosicionJugador, string> = {
  ARQ: "Arqueros",
  DEF: "Defensores",
  MED: "Mediocampistas",
  DEL: "Delanteros",
};

const DETALLE_POSICION: Record<PosicionJugador, string> = {
  ARQ: "Arquero",
  DEF: "Defensor",
  MED: "Mediocampista",
  DEL: "Delantero",
};

const FILTROS: { label: string; value: PosicionFiltro }[] = [
  { label: "Todos", value: "TODOS" },
  { label: "Arqueros", value: "ARQ" },
  { label: "Defensores", value: "DEF" },
  { label: "Mediocampistas", value: "MED" },
  { label: "Delanteros", value: "DEL" },
];

const POSICIONES: PosicionJugador[] = ["ARQ", "DEF", "MED", "DEL"];

function ordenarJugadores(a: Jugador, b: Jugador): number {
  const porPosicion = ORDEN_POSICION[a.posicion] - ORDEN_POSICION[b.posicion];
  if (porPosicion !== 0) return porPosicion;

  if (a.numero === null && b.numero !== null) return 1;
  if (a.numero !== null && b.numero === null) return -1;
  if (a.numero !== null && b.numero !== null && a.numero !== b.numero) {
    return a.numero - b.numero;
  }

  return `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, "es");
}

function claveJugador(jugador: Jugador): string {
  return [
    jugador.numero ?? "sin-numero",
    jugador.nombre,
    jugador.apellido,
    jugador.posicion,
    jugador.foto,
  ].join(":");
}

function banderaPara(nacionalidad: string): string | null {
  const banderas: Record<string, string> = {
    Argentina: "🇦🇷",
    Colombia: "🇨🇴",
    Uruguay: "🇺🇾",
  };

  return banderas[nacionalidad] ?? null;
}

function formatearFechaActualizacion(actualizadoEn: string): string {
  const fecha = new Date(actualizadoEn);
  if (Number.isNaN(fecha.getTime())) return actualizadoEn;

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(fecha);
}

function mensajeDeError(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "No pudimos cargar el plantel oficial.";
}

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
                  {jugador.numero ?? "—"}
              </span>
                {banderaPara(jugador.nacionalidad) && (
                  <span className="text-4xl mt-4">{banderaPara(jugador.nacionalidad)}</span>
                )}
            </div>
          )}

          <div className="absolute top-3 left-3 z-20">
            <span className="text-white/25 font-display font-black text-4xl leading-none hover:text-white/50 transition-colors">
              {jugador.numero ?? "—"}
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
              {jugador.numero ?? "—"}
            </p>
          </div>

          <div className="h-px bg-white/10 my-3" />

          <div className="flex flex-col gap-3 flex-1">
            <div>
              <p className="text-white/30 text-[9px] uppercase tracking-widest mb-0.5">Nacionalidad</p>
              <p className="text-white font-semibold text-sm flex items-center gap-1.5">
                {banderaPara(jugador.nacionalidad) && <span>{banderaPara(jugador.nacionalidad)}</span>}
                {jugador.nacionalidad}
              </p>
            </div>
            <div>
              <p className="text-white/30 text-[9px] uppercase tracking-widest mb-0.5">Posición</p>
              <p className="text-white font-semibold text-sm">{DETALLE_POSICION[jugador.posicion]}</p>
            </div>
            <div>
              <p className="text-white/30 text-[9px] uppercase tracking-widest mb-0.5">Dorsal</p>
              <p className="text-white font-black text-2xl font-display">{jugador.numero ?? "—"}</p>
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

function PonzioCard() {
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
          <div
            role="img"
            aria-label="Leonardo Ponzio, director técnico interino"
            className="w-full h-full bg-gradient-to-br from-[#17171d] via-[#292933] to-river-red flex items-center justify-center"
          >
            <span className="font-display text-7xl text-white/90 tracking-tight">LP</span>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-river-red/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
            <p className="text-river-red text-[10px] font-bold uppercase tracking-widest">Director Técnico</p>
            <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest">Leonardo</p>
            <p className="text-white font-display font-bold text-base uppercase">Ponzio</p>
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
          <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mt-1">Leonardo</p>
          <p className="text-white font-display font-black text-xl uppercase">Ponzio</p>

          <div className="h-px bg-white/10 my-3" />
          <div className="flex flex-col gap-3 flex-1">
            <div>
              <p className="text-white/30 text-[9px] uppercase tracking-widest mb-0.5">Nacionalidad</p>
              <p className="text-white font-semibold text-sm flex items-center gap-1.5">🇦🇷 Argentina</p>
            </div>
            <div>
              <p className="text-white/30 text-[9px] uppercase tracking-widest mb-0.5">Cargo</p>
              <p className="text-white font-semibold text-sm">Entrenador interino</p>
            </div>
            <div>
              <p className="text-white/30 text-[9px] uppercase tracking-widest mb-0.5">Desde</p>
              <p className="text-white font-black text-xl font-display">27/08/2026</p>
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
  const {
    data: plantel,
    error: plantelError,
    isError: plantelTieneError,
    isFetching: plantelEstaCargando,
    isLoading: plantelEstaCargandoInicial,
    refetch: reintentarPlantel,
  } = useGetPlantel({
    query: {
      queryKey: getGetPlantelQueryKey(),
      enabled: !mundialActivo,
      refetchOnMount: true,
      staleTime: 5 * 60 * 1000,
    },
  });

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

  const jugadores = plantel?.jugadores ?? [];
  const jugadoresFiltrados =
    filtro === "TODOS"
      ? [...jugadores].sort(ordenarJugadores)
      : jugadores.filter((j) => j.posicion === filtro).sort(ordenarJugadores);

  const grupos = filtro === "TODOS"
    ? POSICIONES.map((pos) => ({
        posicion: pos,
        jugadores: jugadoresFiltrados.filter((j) => j.posicion === pos),
      }))
    : null;

  return (
    <div className="min-h-screen bg-[#FAFAF8] newspaper-texture">
      {/* Hero editorial */}
      <div className="relative pt-32 pb-16 px-4 overflow-hidden bg-tinta border-b-4 border-river-red">
        <div className="relative z-10 max-w-7xl mx-auto text-center">
          <p className="text-river-red font-bold uppercase tracking-[0.3em] text-sm mb-3 font-mono">
            Club Atlético River Plate
          </p>
          <h1 className="font-display text-5xl md:text-7xl text-white uppercase leading-none tracking-tight mb-4">
            PLANTILLA PROFESIONAL
          </h1>
          <p className="text-white/70 text-lg font-mono">
            Temporada 2026 · DT interino Leonardo Ponzio
          </p>
          <p className="text-white/50 text-sm mt-2">Tocá cada jugador para ver su información</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="sticky top-16 z-40 bg-white border-b-2 border-gris-borde">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-none">
            {FILTROS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFiltro(f.value)}
                className={`relative px-5 py-4 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors duration-200 ${
                  filtro === f.value ? "text-tinta" : "text-gris-meta hover:text-tinta"
                }`}
              >
                {f.label}
                {filtro === f.value && (
                  <motion.div
                    layoutId="filtro-underline"
                    className="absolute bottom-0 left-0 right-0 h-1 bg-river-red"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
            <div className="ml-auto pl-4 flex-shrink-0 text-gris-meta text-xs py-4 hidden md:block font-mono">
              {jugadoresFiltrados.length} jugadores
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 pt-10 pb-6">
        <AnimatePresence mode="wait">
          {plantelEstaCargandoInicial ? (
            <motion.div
              key="cargando"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-lg border border-gris-borde bg-white p-10 text-center"
              role="status"
              aria-live="polite"
            >
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gris-borde border-t-river-red" />
              <p className="font-display text-lg font-bold uppercase tracking-widest text-tinta">
                Cargando plantel oficial
              </p>
              <p className="mt-2 text-sm text-gris-meta">
                Estamos buscando la última lista validada por River Plate.
              </p>
            </motion.div>
          ) : plantelTieneError ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-lg border border-river-red/30 bg-white p-10 text-center"
              role="alert"
            >
              <p className="font-display text-lg font-bold uppercase tracking-widest text-tinta">
                No se pudo cargar el plantel
              </p>
              <p className="mx-auto mt-2 max-w-xl text-sm text-gris-meta">
                {mensajeDeError(plantelError)}
              </p>
              <button
                type="button"
                onClick={() => void reintentarPlantel()}
                disabled={plantelEstaCargando}
                className="mt-6 inline-flex items-center justify-center rounded-md bg-river-red px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-river-red/90 disabled:cursor-wait disabled:opacity-60"
              >
                {plantelEstaCargando ? "Reintentando…" : "Reintentar"}
              </button>
            </motion.div>
          ) : jugadores.length === 0 ? (
            <motion.div
              key="vacio"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-lg border border-gris-borde bg-white p-10 text-center"
            >
              <p className="font-display text-lg font-bold uppercase tracking-widest text-tinta">
                El plantel todavía no está disponible
              </p>
              <p className="mt-2 text-sm text-gris-meta">
                La fuente oficial aún no publicó una lista validada.
              </p>
            </motion.div>
          ) : grupos ? (
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
                    <div className="w-1 h-6 bg-river-red" />
                    <h2 className="text-tinta font-display font-bold text-xl uppercase tracking-widest">
                      {LABEL_POSICION[posicion]}
                    </h2>
                    <div className="flex-1 h-px bg-gris-borde" />
                    <span className="text-gris-meta text-xs font-mono">{jugadores.length}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
                    {jugadores.map((jugador, i) => (
                      <PlayerCard key={claveJugador(jugador)} jugador={jugador} index={i} />
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
                <PlayerCard key={claveJugador(jugador)} jugador={jugador} index={i} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── CUERPO TÉCNICO ── */}
      <div className="max-w-7xl mx-auto px-4 pb-16 mt-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-1 h-6 bg-river-red" />
          <h2 className="text-tinta font-display font-bold text-xl uppercase tracking-widest">
            Director Técnico
          </h2>
          <div className="flex-1 h-px bg-gris-borde" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
          <PonzioCard />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-10 text-center">
        {plantel && (
          <p className="text-gris-meta text-xs font-mono">
            Plantel actualizado el {formatearFechaActualizacion(plantel.actualizadoEn)} · Fuente:{" "}
            <a
              href={plantel.fuente}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-river-red/50 underline-offset-2 hover:text-tinta"
            >
              River Plate
            </a>
          </p>
        )}
        <p className="text-gris-meta text-xs font-mono">
          Cuerpo técnico actualizado al 27 de agosto de 2026 · Fuente: comunicado oficial de River Plate
        </p>
      </div>
    </div>
  );
}
