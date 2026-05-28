import { useMemo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { MapPin, Trophy, Calendar, ChevronRight } from "lucide-react";
import { MapaEstadios } from "@/components/MapaEstadios";
import { CountdownArgentina } from "@/components/CountdownArgentina";
import { SolDeMayo } from "@/components/SolDeMayo";
import { GRUPOS, GRUPO_ARGENTINA, ESTADIOS, EQ, JUGADORES_SCALONETA } from "@/lib/mundial-data";
import { setMundialOverride } from "@/lib/mundial-mode";

const PAISES_COLORS: Record<string, string> = {
  USA: "from-blue-600 to-red-500",
  "Canadá": "from-red-600 to-white",
  "México": "from-green-600 to-red-600",
};

export default function MundialHome() {
  const totalEquipos = useMemo(() => GRUPOS.reduce((a, g) => a + g.equipos.length, 0), []);

  return (
    <div className="bg-[#0a1628] text-white min-h-screen">
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

      {/* ═══════════ GRUPOS ═══════════ */}
      <section className="py-16 bg-gradient-to-b from-[#0a1628] to-[#091324]">
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
      <section className="relative py-16 bg-gradient-to-b from-[#091324] via-[#0a1f3a] to-[#091324] overflow-hidden">
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
                    <div className="absolute inset-0 opacity-20 flex items-center justify-center">
                      <SolDeMayo size={140} />
                    </div>
                    {esDT ? (
                      <div className="relative font-display font-black text-arg-dorado text-3xl md:text-4xl text-center leading-none">
                        DT<br />
                        <span className="text-lg md:text-xl tracking-widest text-white/80">SCALONI</span>
                      </div>
                    ) : (
                      <div className="relative font-display font-black text-white text-6xl md:text-7xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                        {j.dorsal}
                      </div>
                    )}
                    <span className="absolute bottom-2 left-2 text-xl">🇦🇷</span>
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
      <section className="py-16 bg-[#091324]">
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

      {/* Footer — recordatorio + acceso al sitio de River */}
      <div className="bg-[#0a1628] border-t border-white/5 py-10">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="text-white/50 text-sm mb-4">
            ¿Buscás contenido de <span className="font-semibold text-white/80">Club Atlético River Plate</span>?
            Durante el Mundial mantenemos toda la historia y noticias millonarias intactas.
          </p>
          <button
            type="button"
            onClick={() => {
              setMundialOverride("off");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="inline-flex items-center gap-2 bg-river-red hover:bg-river-red/90 text-white font-bold px-6 py-3 rounded-full uppercase tracking-wide text-sm transition-all shadow-lg hover:-translate-y-0.5"
          >
            🔴⚪ Visitar River en Israel <ChevronRight className="w-4 h-4" />
          </button>
          <p className="text-white/30 text-[11px] mt-4">
            Modo Mundial vuelve solo después · Reverte al rojo y blanco automáticamente el 21/07
          </p>
        </div>
      </div>
    </div>
  );
}
