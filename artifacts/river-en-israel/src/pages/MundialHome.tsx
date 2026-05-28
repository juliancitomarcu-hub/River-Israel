import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Trophy, Calendar, ChevronRight, ChevronLeft, Play, X, ZoomIn } from "lucide-react";
import { MapaEstadios } from "@/components/MapaEstadios";
import { CountdownArgentina } from "@/components/CountdownArgentina";
import { SolDeMayo } from "@/components/SolDeMayo";
import { GRUPOS, GRUPO_ARGENTINA, ESTADIOS, EQ, JUGADORES_SCALONETA } from "@/lib/mundial-data";

interface GaleriaFoto { id: number; url: string; caption: string; orden: number; }
interface VideoGaleria { id: number; url: string; titulo: string; thumbnail: string | null; orden: number; }

const resolverUrl = (url: string) => url.startsWith("/objects/") ? `/api/storage${url}` : url;

const PAISES_COLORS: Record<string, string> = {
  USA: "from-blue-600 to-red-500",
  "Canadá": "from-red-600 to-white",
  "México": "from-green-600 to-red-600",
};

export default function MundialHome() {
  const totalEquipos = useMemo(() => GRUPOS.reduce((a, g) => a + g.equipos.length, 0), []);

  // Triple-click en bandera Argentina → Redactor IA filtrado en Selección
  const banderaClicks = useRef(0);
  const banderaTimer = useRef<number | null>(null);
  const handleBanderaClick = () => {
    banderaClicks.current += 1;
    if (banderaTimer.current) window.clearTimeout(banderaTimer.current);
    if (banderaClicks.current >= 3) {
      banderaClicks.current = 0;
      window.location.href = "/redactor?tab=publicaciones-seleccion";
      return;
    }
    banderaTimer.current = window.setTimeout(() => { banderaClicks.current = 0; }, 1200);
  };

  // ── Galería + Videos al pie (como River) ────────────────────────────────
  const [videos, setVideos] = useState<VideoGaleria[]>([]);
  const [videoAbierto, setVideoAbierto] = useState<VideoGaleria | null>(null);
  const [galeriaFotos, setGaleriaFotos] = useState<GaleriaFoto[]>([]);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [paginaGaleria, setPaginaGaleria] = useState(0);
  const COLS = 4; const ROWS = 3; const PAGE_SIZE = COLS * ROWS;
  const totalPaginas = Math.max(1, Math.ceil(galeriaFotos.length / PAGE_SIZE));

  useEffect(() => {
    fetch("/api/videos", { cache: "no-store" }).then(r => r.json())
      .then((d: { videos?: VideoGaleria[] }) => setVideos(d.videos ?? [])).catch(() => {});
    fetch("/api/galeria", { cache: "no-store" }).then(r => r.json())
      .then((d: { fotos?: GaleriaFoto[] }) => setGaleriaFotos(d.fotos ?? [])).catch(() => {});
  }, []);

  const cerrarLightbox = useCallback(() => setLightboxIdx(null), []);
  const irAnterior = useCallback(() => setLightboxIdx(i => i !== null ? (i - 1 + galeriaFotos.length) % galeriaFotos.length : null), [galeriaFotos.length]);
  const irSiguiente = useCallback(() => setLightboxIdx(i => i !== null ? (i + 1) % galeriaFotos.length : null), [galeriaFotos.length]);
  useEffect(() => {
    if (lightboxIdx === null) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") irAnterior();
      if (e.key === "ArrowRight") irSiguiente();
      if (e.key === "Escape") cerrarLightbox();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [lightboxIdx, irAnterior, irSiguiente, cerrarLightbox]);

  const fotosPagina = galeriaFotos.slice(paginaGaleria * PAGE_SIZE, (paginaGaleria + 1) * PAGE_SIZE);

  return (
    <div className="bg-[#0a1628] text-white min-h-screen overflow-x-hidden">
      {/* ═══════════ HERO ═══════════ */}
      <section className="relative overflow-hidden pt-28 pb-20 md:pt-32 md:pb-24 bg-mundial-mesh">
        {/* Sol de Mayo gigante girando lento detrás del título */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%] opacity-[0.10]">
          <SolDeMayo size={720} spin color="#F1B82D" />
        </div>
        {/* Orbes flotantes */}
        <div className="pointer-events-none absolute -top-10 -left-10 w-72 h-72 bg-arg-celeste/30 rounded-full blur-[120px] animate-float-orb" />
        <div className="pointer-events-none absolute bottom-0 -right-10 w-80 h-80 bg-arg-dorado/25 rounded-full blur-[140px] animate-float-orb" style={{ animationDelay: "3s" }} />
        {/* Bandas sutiles de bandera */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none">
          <div className="absolute inset-x-0 top-0 h-1/3 bg-arg-celeste" />
          <div className="absolute inset-x-0 top-1/3 h-1/3 bg-white" />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-arg-celeste" />
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 bg-arg-dorado/95 text-[#0a1628] text-[10px] md:text-xs font-bold uppercase tracking-[0.22em] px-4 py-1.5 rounded-full mb-6 shadow-lg shadow-arg-dorado/30"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#0a1628] animate-pulse" />
              Copa del Mundo 2026 · USA · Canadá · México
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl lg:text-[7.5rem] font-display font-black mb-5 leading-[0.95] tracking-tight text-shadow-cinema"
            >
              LA <span className="text-arg-celeste">SCALONETA</span>
              <br />
              <span className="text-arg-dorado">EN ISRAEL</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-white/80 text-base md:text-xl max-w-2xl mx-auto leading-relaxed flex items-center justify-center gap-2 flex-wrap"
            >
              Toda la pasión de la Selección Argentina vivida desde Tierra Santa.
              Defendiendo la corona del mundo
              <Trophy className="w-5 h-5 md:w-6 md:h-6 text-arg-dorado inline-block" />
            </motion.p>
          </div>

          {/* Countdown */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <CountdownArgentina />
          </motion.div>
        </div>

        {/* Divider con sol de mayo central */}
        <div className="relative z-10 mt-12 flex items-center justify-center gap-4">
          <div className="h-px w-24 md:w-40 bg-gradient-to-r from-transparent to-arg-dorado/60" />
          <SolDeMayo size={32} />
          <div className="h-px w-24 md:w-40 bg-gradient-to-l from-transparent to-arg-dorado/60" />
        </div>
      </section>

      {/* Bandera Argentina clickeable (triple-click → Redactor IA) */}
      <div className="relative z-10 -mt-2 mb-4 flex items-center justify-center">
        <button
          type="button"
          onClick={handleBanderaClick}
          title=""
          aria-label="Bandera Argentina"
          className="select-none cursor-default focus:outline-none opacity-70 hover:opacity-100 transition-opacity"
        >
          <span className="text-3xl md:text-4xl block" style={{ filter: "drop-shadow(0 0 8px rgba(116,172,223,0.35))" }}>🇦🇷</span>
        </button>
      </div>

      {/* ═══════════ GRUPOS ═══════════ */}
      <section id="grupos" className="py-16 bg-gradient-to-b from-[#0a1628] to-[#091324]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="bg-arg-celeste/20 text-arg-celeste border border-arg-celeste/40 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest inline-block mb-3">
              48 equipos · 12 grupos
            </span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-2">
              GRUPOS DEL <span className="text-arg-celeste">MUNDIAL</span>
            </h2>
            <p className="text-white/60 text-sm">
              {totalEquipos} selecciones. Una sola corona. Argentina defiende el título.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {GRUPOS.map((g, i) => {
              const isArg = g.letra === GRUPO_ARGENTINA;
              return (
                <motion.div
                  key={g.letra}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04, duration: 0.4 }}
                  className={`rounded-2xl p-4 transition-all ${
                    isArg
                      ? "bg-gradient-to-br from-arg-celeste/20 to-arg-dorado/15 border-2 border-arg-dorado shadow-[0_0_30px_rgba(241,184,45,0.25)]"
                      : "bg-white/5 border border-white/10 hover:border-white/25"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={`font-display text-2xl font-bold ${isArg ? "text-arg-dorado" : "text-white"}`}>
                      Grupo {g.letra}
                    </h3>
                    {isArg && (
                      <span className="text-[9px] font-bold uppercase tracking-widest bg-arg-dorado text-[#0a1628] px-2 py-0.5 rounded-full">
                        Argentina
                      </span>
                    )}
                  </div>
                  <ul className="space-y-1.5">
                    {g.equipos.map(eq => (
                      <li
                        key={eq.code}
                        className={`flex items-center gap-2 text-sm ${
                          isArg && eq.code === "ARG"
                            ? "text-arg-dorado font-bold"
                            : "text-white/85"
                        }`}
                      >
                        <span className="text-base">{eq.bandera}</span>
                        <span className="truncate">{eq.nombre}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════ FIGURAS DE LA SCALONETA ═══════════ */}
      <section id="plantel" className="relative py-16 bg-gradient-to-b from-[#091324] via-[#0a1f3a] to-[#091324] overflow-hidden">
        <div className="pointer-events-none absolute -top-20 -right-20 opacity-[0.06]">
          <SolDeMayo size={420} spin />
        </div>
        <div className="pointer-events-none absolute -bottom-32 -left-20 opacity-[0.05]">
          <SolDeMayo size={360} />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 bg-arg-celeste/15 text-arg-celeste border border-arg-celeste/40 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-arg-celeste animate-pulse" />
              Plantel campeón · A defender la corona
            </span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-2">
              FIGURAS DE LA <span className="text-arg-celeste">SCALONETA</span>
            </h2>
            <p className="text-white/60 text-sm max-w-2xl mx-auto">
              El núcleo del campeón de Qatar 2022 y bicampeón de América. Estos son los que van por la cuarta estrella.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {JUGADORES_SCALONETA.map((j, i) => {
              const esDT = j.posicion === "DT";
              return (
                <motion.div
                  key={`${j.apellido}-${j.dorsal}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                  className={`group relative rounded-2xl overflow-hidden border transition-all hover:-translate-y-1 ${
                    j.esCapitan
                      ? "bg-gradient-to-br from-arg-dorado/30 via-arg-celeste/20 to-arg-dorado/10 border-arg-dorado shadow-[0_0_25px_rgba(241,184,45,0.25)]"
                      : esDT
                      ? "bg-gradient-to-br from-arg-celeste/25 to-[#0a1628] border-arg-celeste/50"
                      : "bg-gradient-to-br from-arg-celeste/10 to-[#0a1628] border-white/10 hover:border-arg-celeste/50"
                  }`}
                >
                  {j.esCapitan && (
                    <span className="absolute top-2 right-2 bg-arg-dorado text-[#0a1628] text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded">
                      ⭐ Capitán
                    </span>
                  )}
                  <div className="relative aspect-square flex items-center justify-center bg-gradient-to-br from-arg-celeste/30 via-white/5 to-[#0a1628] overflow-hidden">
                    {/* Fallback siempre presente, foto encima */}
                    <div className="absolute inset-0 opacity-20 flex items-center justify-center">
                      <SolDeMayo size={140} />
                    </div>
                    {esDT ? (
                      <div className="relative font-display font-black text-arg-dorado text-3xl md:text-4xl text-center leading-none z-[1]">
                        DT<br />
                        <span className="text-lg md:text-xl tracking-widest text-white/80">SCALONI</span>
                      </div>
                    ) : (
                      <div className="relative font-display font-black text-white text-6xl md:text-7xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] z-[1]">
                        {j.dorsal}
                      </div>
                    )}
                    {j.foto && (
                      <img
                        src={j.foto}
                        alt={`${j.nombre} ${j.apellido}`}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover object-top z-[2]"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                    {/* Degradado abajo para que el dorsal/badge se lea */}
                    {j.foto && (
                      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#0a1628]/85 to-transparent z-[3]" />
                    )}
                    {!esDT && j.foto && (
                      <span className="absolute bottom-2 right-2 z-[4] font-display font-black text-white text-2xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                        {j.dorsal}
                      </span>
                    )}
                    <span className="absolute bottom-2 left-2 text-xl z-[4]">🇦🇷</span>
                  </div>
                  <div className="p-3 md:p-4 text-center">
                    <h3 className="font-display font-bold text-white text-sm md:text-base leading-tight uppercase tracking-wide">
                      {j.nombre}
                    </h3>
                    <h3 className={`font-display font-black text-base md:text-lg leading-tight uppercase tracking-wide ${j.esCapitan ? "text-arg-dorado" : "text-arg-celeste"}`}>
                      {j.apellido}
                    </h3>
                    <p className="text-white/55 text-[10px] md:text-[11px] uppercase tracking-widest mt-1.5">
                      {j.posicion}
                    </p>
                    <p className="text-white/70 text-[11px] md:text-xs mt-0.5 font-medium">
                      {j.club}
                    </p>
                    {j.apodo && (
                      <p className="text-arg-dorado/90 text-[10px] italic mt-1 leading-tight">
                        "{j.apodo}"
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          <p className="text-center text-white/40 text-xs mt-8">
            Lista completa de 26 convocados se confirma con el anuncio oficial de Scaloni.
          </p>
        </div>
      </section>

      {/* ═══════════ ESTADIOS ═══════════ */}
      <section id="estadios" className="py-16 bg-[#091324]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="bg-arg-dorado/20 text-arg-dorado border border-arg-dorado/40 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest inline-block mb-3">
              16 sedes · 3 países
            </span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-2">
              ESTADIOS DEL <span className="text-arg-dorado">MUNDIAL</span>
            </h2>
            <p className="text-white/60 text-sm max-w-2xl mx-auto">
              Desde el legendario Azteca hasta el MetLife de la final. 16 escenarios para la fiesta más grande del fútbol.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ESTADIOS.map((e, i) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03 }}
                className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-arg-celeste/40 rounded-2xl p-4 transition-all cursor-pointer"
              >
                <div className={`h-1 w-12 rounded-full mb-3 bg-gradient-to-r ${PAISES_COLORS[e.pais]}`} />
                <h3 className="font-display font-bold text-white text-lg leading-tight mb-1 group-hover:text-arg-celeste transition-colors">
                  {e.nombre}
                </h3>
                <p className="text-white/60 text-xs flex items-center gap-1 mb-2">
                  <MapPin className="w-3 h-3" /> {e.ciudad} · {e.pais}
                </p>
                <div className="flex items-center justify-between text-[11px] text-white/40">
                  <span>{e.capacidad.toLocaleString()} esp.</span>
                  <span>Desde {e.inaugurado}</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Mapa interactivo */}
          <div className="mt-10">
            <h3 className="text-center text-arg-dorado font-display font-bold text-lg uppercase tracking-widest mb-4">
              Las 16 sedes en el mapa
            </h3>
            <MapaEstadios />
            <p className="text-center text-white/40 text-xs mt-3">
              Hacé click en cada marcador para ver capacidad, año de inauguración y detalles.
            </p>
          </div>

          {/* CTA al fixture completo */}
          <div className="mt-10 text-center">
            <Link
              href="/mundial/fixture"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-arg-celeste to-arg-dorado text-[#0a1628] font-bold px-6 py-3 rounded-full uppercase tracking-wide text-sm shadow-lg hover:-translate-y-0.5 transition-transform"
            >
              <Calendar className="w-4 h-4" />
              Ver fixture completo Grupo A
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════ CTA NOTICIAS ═══════════ */}
      <section className="py-16 bg-gradient-to-b from-[#091324] to-[#0a1628]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Trophy className="w-12 h-12 text-arg-dorado mx-auto mb-4" />
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-3">
            COBERTURA <span className="text-arg-celeste">MILLONARIA</span>
          </h2>
          <p className="text-white/70 mb-8 max-w-2xl mx-auto">
            Análisis tácticos, previas, post-partidos y todo lo que pasa con la Scaloneta y River durante el Mundial.
          </p>
          <Link
            href="/actualidad"
            className="inline-flex items-center gap-2 bg-arg-dorado hover:bg-arg-dorado/90 text-[#0a1628] font-bold px-6 py-3 rounded-full uppercase tracking-wide text-sm transition-all shadow-lg hover:-translate-y-0.5"
          >
            Ver últimas noticias <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ═══════════ GALERÍA + VIDEOS (al pie, como en River) ═══════════ */}
      <section id="galeria-videos" className="py-20 bg-gradient-to-b from-[#091324] to-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="bg-arg-celeste/15 text-arg-celeste border border-arg-celeste/40 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest inline-block mb-3">
              Hinchas · Selección · Mundial
            </span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-2">
              GALERÍA Y <span className="text-arg-celeste">VIDEOS</span>
            </h2>
            <p className="text-white/60 text-sm">Momentos de la Scaloneta y la pasión argentina en Israel.</p>
          </div>

          {/* Videos */}
          {videos.length > 0 && (
            <div className="mb-12">
              <h3 className="text-arg-dorado font-display font-bold uppercase tracking-widest text-sm mb-4">▶ Videos</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {videos.slice(0, 8).map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVideoAbierto(v)}
                    className="group relative aspect-video rounded-xl overflow-hidden border border-white/10 hover:border-arg-celeste/60 transition-all"
                  >
                    {v.thumbnail ? (
                      <img src={resolverUrl(v.thumbnail)} alt={v.titulo} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-arg-celeste/30 to-[#0a1628]" />
                    )}
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-arg-dorado flex items-center justify-center shadow-xl">
                        <Play className="w-5 h-5 text-[#0a1628] ml-0.5" />
                      </div>
                    </div>
                    <p className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/90 to-transparent text-white text-xs font-semibold truncate">
                      {v.titulo}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fotos */}
          {galeriaFotos.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-arg-dorado font-display font-bold uppercase tracking-widest text-sm">📸 Fotos</h3>
                {totalPaginas > 1 && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPaginaGaleria(p => Math.max(0, p - 1))} disabled={paginaGaleria === 0}
                      className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-white/60">{paginaGaleria + 1} / {totalPaginas}</span>
                    <button onClick={() => setPaginaGaleria(p => Math.min(totalPaginas - 1, p + 1))} disabled={paginaGaleria >= totalPaginas - 1}
                      className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {fotosPagina.map((f, idx) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setLightboxIdx(paginaGaleria * PAGE_SIZE + idx)}
                    className="group relative aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-arg-celeste/60 transition-all"
                  >
                    <img src={resolverUrl(f.url)} alt={f.caption} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <ZoomIn className="w-6 h-6 text-white" />
                    </div>
                    {f.caption && (
                      <p className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/85 to-transparent text-white text-[11px] truncate opacity-0 group-hover:opacity-100 transition-opacity">
                        {f.caption}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-center text-white/40 text-sm py-8">
              Pronto vamos a sumar fotos del Mundial 🇦🇷
            </p>
          )}
        </div>

        {/* Lightbox fotos */}
        <AnimatePresence>
          {lightboxIdx !== null && galeriaFotos[lightboxIdx] && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={cerrarLightbox}
              className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
            >
              <button onClick={cerrarLightbox} className="absolute top-4 right-4 text-white/80 hover:text-white p-2">
                <X className="w-6 h-6" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); irAnterior(); }}
                className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 bg-white/5 rounded-full">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <img
                src={resolverUrl(galeriaFotos[lightboxIdx].url)}
                alt={galeriaFotos[lightboxIdx].caption}
                onClick={(e) => e.stopPropagation()}
                className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
              />
              <button onClick={(e) => { e.stopPropagation(); irSiguiente(); }}
                className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 bg-white/5 rounded-full">
                <ChevronRight className="w-6 h-6" />
              </button>
              {galeriaFotos[lightboxIdx].caption && (
                <p className="absolute bottom-6 inset-x-0 text-center text-white/90 text-sm px-6">
                  {galeriaFotos[lightboxIdx].caption}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lightbox videos */}
        <AnimatePresence>
          {videoAbierto && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setVideoAbierto(null)}
              className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
            >
              <button onClick={() => setVideoAbierto(null)} className="absolute top-4 right-4 text-white/80 hover:text-white p-2">
                <X className="w-6 h-6" />
              </button>
              <video
                src={resolverUrl(videoAbierto.url)}
                controls
                autoPlay
                onClick={(e) => e.stopPropagation()}
                className="max-h-[85vh] max-w-[90vw] rounded-lg shadow-2xl"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Cross-link al sitio de River, como pie de página */}
      <div className="bg-[#0a1628] border-t border-white/5 py-10">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="text-white/50 text-sm mb-4">
            ¿Buscás contenido de <span className="font-semibold text-white/80">Club Atlético River Plate</span>?
            La filial sigue activa con noticias, historia y todo lo millonario.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-river-red hover:bg-river-red/90 text-white font-bold px-6 py-3 rounded-full uppercase tracking-wide text-sm transition-all shadow-lg hover:-translate-y-0.5"
          >
            ⚪️🔴 Ir a River en Israel <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
