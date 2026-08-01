import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Trophy, MapPin, Clock } from "lucide-react";
import { useMatches } from "@/hooks/use-river-data";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

type FiltroEstado = "TODOS" | "UPCOMING" | "FINISHED" | "LIVE";

export default function Fixture() {
  const { data: matches, isLoading } = useMatches();
  const [filtro, setFiltro] = useState<FiltroEstado>("TODOS");

  const partidosFiltrados = matches
    ? filtro === "TODOS"
      ? matches
      : matches.filter(m => m.status === filtro)
    : [];

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] newspaper-texture pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12 pb-8 border-b-4 border-tinta">
          <Link href="/">
            <span className="inline-block text-xs text-gris-meta hover:text-river-red font-bold uppercase tracking-wider mb-4 cursor-pointer transition-colors">
              ← Volver a la portada
            </span>
          </Link>
          <h1 className="font-display text-5xl md:text-7xl text-tinta mb-3">
            FIXTURE Y RESULTADOS
          </h1>
          <p className="text-gris-meta text-lg font-mono">
            Todos los partidos de River — Liga, Copas y más
          </p>
        </div>

        {/* Filtros */}
        <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
          {(["TODOS", "UPCOMING", "FINISHED", "LIVE"] as FiltroEstado[]).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={cn(
                "px-5 py-2 font-bold text-sm uppercase tracking-wider transition-all border-2",
                filtro === f
                  ? "bg-river-red text-white border-river-red"
                  : "bg-white text-tinta border-gris-borde hover:border-tinta"
              )}
            >
              {f === "TODOS" && "Todos"}
              {f === "UPCOMING" && "Próximos"}
              {f === "FINISHED" && "Finalizados"}
              {f === "LIVE" && "En vivo"}
            </button>
          ))}
        </div>

        {/* Lista de partidos */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-river-red border-t-transparent rounded-full animate-spin" />
              <p className="text-gris-meta font-bold font-display text-xl">CARGANDO FIXTURE...</p>
            </div>
          </div>
        ) : partidosFiltrados.length === 0 ? (
          <div className="text-center py-20">
            <Trophy className="w-16 h-16 text-gris-borde mx-auto mb-4" />
            <p className="text-gris-meta text-lg">No hay partidos en esta categoría.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {partidosFiltrados.map((match, i) => {
              const [golesRiver, golesRival] = match.isRiverHome
                ? [match.homeScore, match.awayScore]
                : [match.awayScore, match.homeScore];
              const ganamos = match.status === 'FINISHED' && golesRiver !== null && golesRival !== null && golesRiver > golesRival;
              const perdimos = match.status === 'FINISHED' && golesRiver !== null && golesRival !== null && golesRiver < golesRival;
              const empate = match.status === 'FINISHED' && golesRiver !== null && golesRival !== null && golesRiver === golesRival;

              return (
                <motion.article
                  key={match.id}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: "-40px" }}
                  variants={fadeIn}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    "bg-white border-2 p-6 hover:shadow-lg transition-all duration-200",
                    match.status === 'LIVE' ? "border-green-500 shadow-lg" : "border-gris-borde hover:border-river-red"
                  )}
                >
                  {/* Cabecera del partido */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-gris-borde">
                    <div className="flex items-center gap-3">
                      <Trophy className="w-5 h-5 text-river-red" />
                      <span className="font-bold text-sm text-tinta uppercase tracking-wide">
                        {match.competition}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono text-gris-meta">
                      {match.status === 'LIVE' && (
                        <span className="flex items-center gap-1 bg-green-500 text-white px-2 py-1 font-bold animate-pulse">
                          EN VIVO
                        </span>
                      )}
                      {match.status === 'FINISHED' && (
                        <span className={cn(
                          "px-2 py-1 font-bold",
                          ganamos ? "bg-green-600 text-white" : perdimos ? "bg-red-700 text-white" : "bg-gray-600 text-white"
                        )}>
                          {ganamos ? "Victoria" : perdimos ? "Derrota" : "Empate"}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {match.date}
                      </span>
                    </div>
                  </div>

                  {/* Marcador */}
                  <div className="flex items-center justify-between gap-4">
                    {/* Equipo local */}
                    <div className="flex-1 text-left">
                      <p className={cn(
                        "font-bold text-lg mb-1",
                        match.isRiverHome ? "text-tinta" : "text-gris-meta"
                      )}>
                        {match.homeTeam}
                      </p>
                      {(match.status === 'FINISHED' || match.status === 'LIVE') && (
                        <p className={cn(
                          "font-display text-4xl font-bold tabular-nums",
                          match.isRiverHome ? "text-tinta" : "text-gris-meta"
                        )}>
                          {match.homeScore ?? 0}
                        </p>
                      )}
                    </div>

                    {/* Separador */}
                    <div className="text-center px-4">
                      <span className="font-display text-2xl text-gris-borde">
                        {match.status === 'FINISHED' || match.status === 'LIVE' ? '—' : 'VS'}
                      </span>
                    </div>

                    {/* Equipo visitante */}
                    <div className="flex-1 text-right">
                      <p className={cn(
                        "font-bold text-lg mb-1",
                        !match.isRiverHome ? "text-tinta" : "text-gris-meta"
                      )}>
                        {match.awayTeam}
                      </p>
                      {(match.status === 'FINISHED' || match.status === 'LIVE') && (
                        <p className={cn(
                          "font-display text-4xl font-bold tabular-nums",
                          !match.isRiverHome ? "text-tinta" : "text-gris-meta"
                        )}>
                          {match.awayScore ?? 0}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Detalles */}
                  {(match.status === 'UPCOMING' && match.horaIsrael) && (
                    <div className="mt-4 pt-3 border-t border-gris-borde flex items-center justify-center gap-4 text-sm text-gris-meta font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-river-red" />
                        {match.horaIsrael}
                      </span>
                    </div>
                  )}
                  {match.estadio && (
                    <div className="mt-2 flex items-center justify-center gap-1 text-xs text-gris-meta font-mono">
                      <MapPin className="w-3 h-3" />
                      {match.estadio}
                    </div>
                  )}
                </motion.article>
              );
            })}
          </div>
        )}

        {/* CTA */}
        <div className="mt-16 bg-tinta border-4 border-river-red p-8 text-center text-white">
          <p className="font-display text-3xl mb-2">VIVÍ LOS PARTIDOS CON LA FILIAL</p>
          <p className="text-white/80 mb-6">Unite al grupo para ver los partidos juntos desde Israel.</p>
          <a
            href="https://chat.whatsapp.com/LGMvmF1bKjJ2PlZ1GqCfo0"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-river-red hover:bg-river-red-hover text-white font-bold px-8 py-3 transition-colors uppercase tracking-wide"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Unite al WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
