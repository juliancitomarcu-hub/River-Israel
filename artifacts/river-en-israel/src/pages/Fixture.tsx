import { motion } from "framer-motion";
import { Trophy, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useMatches } from "@/hooks/use-river-data";
import { cn } from "@/lib/utils";

export default function Fixture() {
  const { data: matches, isLoading, error } = useMatches();

  const proximos = matches?.filter((m) => m.status === "UPCOMING") ?? [];
  const enVivo = matches?.filter((m) => m.status === "LIVE") ?? [];
  const resultados = matches?.filter((m) => m.status === "FINISHED") ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-river-black text-white py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-river-red/30 to-transparent" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver al inicio
          </Link>
          <div className="flex items-center gap-4">
            <Trophy className="w-10 h-10 text-river-red" />
            <div>
              <h1 className="font-display text-4xl md:text-5xl font-bold">Fixture Completo</h1>
              <p className="text-white/60 mt-1">Resultados y próximos partidos de River Plate</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-2 border-river-red border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && !isLoading && (
          <div className="text-center py-12 text-gray-500">
            No se pudieron cargar los partidos. Intentá de nuevo más tarde.
          </div>
        )}

        {/* EN VIVO */}
        {enVivo.length > 0 && (
          <Section titulo="🔴 En Vivo" matches={enVivo} />
        )}

        {/* PRÓXIMOS */}
        {proximos.length > 0 && (
          <Section titulo="Próximos Partidos" matches={proximos} />
        )}

        {/* RESULTADOS */}
        {resultados.length > 0 && (
          <Section titulo="Últimos Resultados" matches={resultados} />
        )}
      </div>
    </div>
  );
}

import type { MatchResult } from "@/hooks/use-river-data";

function Section({ titulo, matches }: { titulo: string; matches: MatchResult[] }) {
  return (
    <section>
      <h2 className="font-display text-2xl font-bold text-river-black mb-6 flex items-center gap-2">
        {titulo}
      </h2>
      <div className="grid gap-3">
        {matches.map((match, i) => (
          <MatchCard key={match.id} match={match} index={i} />
        ))}
      </div>
    </section>
  );
}

function MatchCard({ match, index }: { match: MatchResult; index: number }) {
  const [golesRiver, golesRival] = match.isRiverHome
    ? [match.homeScore, match.awayScore]
    : [match.awayScore, match.homeScore];

  const ganamos = match.status === "FINISHED" && golesRiver !== null && golesRival !== null && golesRiver > golesRival;
  const perdimos = match.status === "FINISHED" && golesRiver !== null && golesRival !== null && golesRiver < golesRival;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{match.competition}</span>
        <div className="flex items-center gap-2">
          {match.status === "LIVE" && (
            <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">
              EN VIVO
            </span>
          )}
          {match.status === "FINISHED" && (
            <span className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded text-white",
              ganamos ? "bg-green-600" : perdimos ? "bg-river-red" : "bg-gray-400"
            )}>
              {ganamos ? "GANAMOS" : perdimos ? "PERDIMOS" : "EMPATE"}
            </span>
          )}
          <span className="text-xs text-gray-400">{match.date}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Local */}
        <div className={cn(
          "flex-1 text-right font-bold",
          match.isRiverHome ? "text-river-black" : "text-gray-400"
        )}>
          {match.homeTeam}
        </div>

        {/* Marcador */}
        <div className="font-display text-2xl font-bold bg-river-black text-white px-4 py-1 rounded-lg min-w-[80px] text-center">
          {match.status === "UPCOMING"
            ? <span className="text-sm text-gray-400">vs</span>
            : <span>{match.homeScore} <span className="text-river-red/60">-</span> {match.awayScore}</span>
          }
        </div>

        {/* Visitante */}
        <div className={cn(
          "flex-1 font-bold",
          !match.isRiverHome ? "text-river-black" : "text-gray-400"
        )}>
          {match.awayTeam}
        </div>
      </div>

      {match.status === "UPCOMING" && match.horaIsrael && (
        <p className="text-center text-sm text-river-red font-semibold mt-2">
          ⏰ {match.horaIsrael}
        </p>
      )}
    </motion.div>
  );
}
