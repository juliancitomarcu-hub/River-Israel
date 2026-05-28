import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowLeft, MapPin, Trophy } from "lucide-react";
import {
  FIXTURE_ARGENTINA,
  FIXTURE_GRUPO_A,
  TABLA_GRUPO_A_INICIAL,
  GRUPO_ARGENTINA,
  EQ,
  estadioPorId,
  formatearHoraIsrael,
} from "@/lib/mundial-data";

export default function MundialFixture() {
  // Agrupar por JORNADA (1/2/3), no por fecha calendario — los partidos
  // de la última jornada se juegan en simultáneo pero pueden caer en distinta
  // fecha en hora Israel si el horario UTC los cruza medianoche.
  const porJornada = new Map<number, typeof FIXTURE_GRUPO_A>();
  for (const p of FIXTURE_GRUPO_A) {
    const j = p.jornada ?? 0;
    const list = porJornada.get(j) ?? [];
    list.push(p);
    porJornada.set(j, list);
  }
  const jornadas = Array.from(porJornada.entries()).sort(([a], [b]) => a - b);

  // El debut de Argentina viene del primer partido del FIXTURE_ARGENTINA — derivamos
  // la fecha desde su kickoff en hora Israel para evitar inconsistencias de copy.
  const debutTxt = formatearHoraIsrael(FIXTURE_ARGENTINA[0]!.kickoffUTC);

  return (
    <div className="min-h-screen bg-[#0a1628] text-white pt-20">
      {/* Hero */}
      <section className="py-12 bg-gradient-to-br from-[#0a1628] via-[#103a5e] to-[#0a1628] border-b border-arg-celeste/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-arg-celeste hover:text-arg-dorado text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver al inicio
          </Link>
          <span className="bg-arg-dorado/20 text-arg-dorado border border-arg-dorado/40 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest inline-block mb-3">
            Grupo {GRUPO_ARGENTINA} · Mundial 2026
          </span>
          <h1 className="text-4xl md:text-6xl font-display font-bold leading-tight">
            FIXTURE DE LA <span className="text-arg-celeste">SCALONETA</span>
          </h1>
          <p className="text-white/70 text-sm md:text-base mt-3 max-w-2xl">
            Todos los partidos del Grupo A en hora Israel (IDT, UTC+3). Argentina debuta vs México
            en el legendario Estadio Azteca: <span className="text-arg-dorado font-semibold">{debutTxt}</span> hora Israel.
          </p>
        </div>
      </section>

      {/* Tabla del grupo */}
      <section className="py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-display font-bold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-arg-dorado" />
            Tabla del Grupo {GRUPO_ARGENTINA}
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
            <table className="w-full text-sm">
              <thead className="bg-white/10 text-white/70 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">#</th>
                  <th className="text-left px-4 py-3">Equipo</th>
                  <th className="px-2 py-3">PJ</th>
                  <th className="px-2 py-3">PG</th>
                  <th className="px-2 py-3">PE</th>
                  <th className="px-2 py-3">PP</th>
                  <th className="px-2 py-3">GF</th>
                  <th className="px-2 py-3">GC</th>
                  <th className="px-2 py-3 text-arg-dorado">Pts</th>
                </tr>
              </thead>
              <tbody>
                {TABLA_GRUPO_A_INICIAL.map((fila, i) => {
                  const esArgentina = fila.equipo.code === EQ.ARG.code;
                  return (
                    <tr
                      key={fila.equipo.code}
                      className={`border-t border-white/5 ${esArgentina ? "bg-arg-celeste/10" : ""}`}
                    >
                      <td className="px-4 py-3 text-white/40">{i + 1}</td>
                      <td className={`px-4 py-3 font-bold ${esArgentina ? "text-arg-celeste" : ""}`}>
                        {fila.equipo.bandera} {fila.equipo.nombre}
                      </td>
                      <td className="px-2 py-3 text-center text-white/70">{fila.pj}</td>
                      <td className="px-2 py-3 text-center text-white/70">{fila.pg}</td>
                      <td className="px-2 py-3 text-center text-white/70">{fila.pe}</td>
                      <td className="px-2 py-3 text-center text-white/70">{fila.pp}</td>
                      <td className="px-2 py-3 text-center text-white/70">{fila.gf}</td>
                      <td className="px-2 py-3 text-center text-white/70">{fila.gc}</td>
                      <td className="px-2 py-3 text-center font-bold text-arg-dorado">{fila.pts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-white/40 text-xs mt-3 italic">
            ⚙️ Tabla en estado inicial. Se actualizará manualmente desde el panel de redactor a medida que avancen las fechas.
          </p>
        </div>
      </section>

      {/* Fixture por fecha */}
      <section className="py-12 bg-[#091324]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-display font-bold mb-6">Partidos</h2>
          <div className="space-y-8">
            {jornadas.map(([numJornada, partidos]) => (
              <div key={numJornada}>
                <h3 className="text-sm uppercase tracking-widest text-arg-dorado font-bold mb-3">
                  Jornada {numJornada}
                </h3>
                <div className="grid gap-3">
                  {partidos.map((p, i) => {
                    const estadio = estadioPorId(p.estadioId);
                    const esArg = p.local.code === EQ.ARG.code || p.visitante.code === EQ.ARG.code;
                    return (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.05 }}
                        className={`rounded-2xl p-4 border transition-all ${
                          esArg
                            ? "bg-arg-celeste/10 border-arg-celeste/40 shadow-[0_0_24px_rgba(116,172,223,0.2)]"
                            : "bg-white/5 border-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-[260px]">
                            <div className="flex items-center gap-2 flex-1 justify-end">
                              <span className={`font-bold ${esArg && p.local.code === EQ.ARG.code ? "text-arg-celeste" : "text-white"}`}>
                                {p.local.nombre}
                              </span>
                              <span className="text-2xl">{p.local.bandera}</span>
                            </div>
                            <span className="text-white/40 font-bold text-sm px-2">vs</span>
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-2xl">{p.visitante.bandera}</span>
                              <span className={`font-bold ${esArg && p.visitante.code === EQ.ARG.code ? "text-arg-celeste" : "text-white"}`}>
                                {p.visitante.nombre}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-arg-dorado font-bold text-sm">{formatearHoraIsrael(p.kickoffUTC)}</div>
                            <div className="text-white/50 text-[11px] flex items-center gap-1 justify-end">
                              <MapPin className="w-3 h-3" />
                              {estadio?.nombre ?? p.estadioId} · {estadio?.ciudad}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-white/40 text-xs mt-10">
            Horarios sujetos a confirmación oficial de FIFA. Todos los tiempos en hora Israel (IDT).
          </p>
        </div>
      </section>
    </div>
  );
}
