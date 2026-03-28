import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface Gol {
  minuto: number | string;
  jugador: string;
  esRiver: boolean;
}

interface Formacion {
  nombre: string;
  numero?: number;
  posicion?: string;
  titular: boolean;
}

interface PartidoDetallado {
  id: string;
  competicion: string;
  fecha: string;
  horaIsrael: string;
  equipoLocal: string;
  equipoVisitante: string;
  golesLocal: number | null;
  golesVisitante: number | null;
  estado: "PROXIMO" | "EN_CURSO" | "FINALIZADO";
  esLocalRiver: boolean;
  minuto?: string;
  goles: Gol[];
  alineacionLocal: Formacion[] | null;
  alineacionVisitante: Formacion[] | null;
  estadio?: string;
}

function FormacionModal({ local, visitante, equipoLocal, equipoVisitante, onClose }: {
  local: Formacion[];
  visitante: Formacion[];
  equipoLocal: string;
  equipoVisitante: string;
  onClose: () => void;
}) {
  const titularesLocal = local.filter((p) => p.titular);
  const titularesVisitante = visitante.filter((p) => p.titular);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="bg-river-black border border-white/10 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-display font-bold text-white text-xl">Posibles Formaciones</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-river-red font-bold text-sm mb-3 uppercase tracking-wider">{equipoLocal}</p>
            <div className="space-y-1">
              {(titularesLocal.length > 0 ? titularesLocal : local).map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-200">
                  {p.numero && <span className="text-gray-500 w-5 text-right">{p.numero}</span>}
                  <span>{p.nombre}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-gray-400 font-bold text-sm mb-3 uppercase tracking-wider">{equipoVisitante}</p>
            <div className="space-y-1">
              {(titularesVisitante.length > 0 ? titularesVisitante : visitante).map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-200">
                  {p.numero && <span className="text-gray-500 w-5 text-right">{p.numero}</span>}
                  <span>{p.nombre}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProximoPartidoWidget() {
  const [partido, setPartido] = useState<PartidoDetallado | null>(null);
  const [error, setError] = useState(false);
  const [showFormaciones, setShowFormaciones] = useState(false);
  const [expandido, setExpandido] = useState(false);

  async function fetchPartido() {
    try {
      const res = await fetch("/api/partido-proximo");
      if (!res.ok) { setError(true); return; }
      const data: PartidoDetallado = await res.json();
      setPartido(data);
      setError(false);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    fetchPartido();
    const interval = setInterval(
      fetchPartido,
      partido?.estado === "EN_CURSO" ? 30_000 : 5 * 60_000
    );
    return () => clearInterval(interval);
  }, [partido?.estado]);

  if (error || !partido) return null;

  const riverScore = partido.esLocalRiver ? partido.golesLocal : partido.golesVisitante;
  const rivalScore = partido.esLocalRiver ? partido.golesVisitante : partido.golesLocal;
  const rival = partido.esLocalRiver ? partido.equipoVisitante : partido.equipoLocal;
  const tieneFormaciones =
    (partido.alineacionLocal?.length ?? 0) > 0 ||
    (partido.alineacionVisitante?.length ?? 0) > 0;

  return (
    <>
      {showFormaciones && tieneFormaciones && (
        <FormacionModal
          local={partido.alineacionLocal!}
          visitante={partido.alineacionVisitante!}
          equipoLocal={partido.equipoLocal}
          equipoVisitante={partido.equipoVisitante}
          onClose={() => setShowFormaciones(false)}
        />
      )}

      <div
        className={cn(
          "bg-river-black rounded-2xl px-5 py-4 text-white shadow-xl border border-white/8 min-w-[240px] max-w-xs cursor-pointer select-none transition-all duration-300",
          expandido ? "ring-1 ring-river-red/30" : "hover:border-white/16"
        )}
        onClick={() => setExpandido((v) => !v)}
      >

        {/* Header fila */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-river-red">
            {partido.estado === "EN_CURSO"
              ? "🔴 En Vivo"
              : partido.estado === "FINALIZADO"
              ? "Resultado"
              : "Próximo Partido"}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 truncate">{partido.competicion}</span>
            <span className={cn(
              "text-gray-500 text-[10px] transition-transform duration-200",
              expandido ? "rotate-180" : "rotate-0"
            )}>▾</span>
          </div>
        </div>

        {/* Marcador / vs */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-display font-bold text-sm text-white truncate flex-1">River</span>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {partido.estado === "PROXIMO" ? (
              <span className="text-gray-400 text-xs font-semibold">vs</span>
            ) : (
              <>
                <span className={cn(
                  "font-display font-bold text-2xl tabular-nums",
                  partido.estado === "EN_CURSO" ? "text-white" : "text-gray-200"
                )}>
                  {riverScore ?? 0}
                </span>
                <span className="text-river-red/60 font-bold text-lg">-</span>
                <span className="font-display font-bold text-2xl tabular-nums text-gray-300">
                  {rivalScore ?? 0}
                </span>
              </>
            )}
          </div>

          <span className="font-display font-bold text-sm text-gray-300 truncate flex-1 text-right">{rival}</span>
        </div>

        {/* Minuto (en vivo) */}
        {partido.estado === "EN_CURSO" && partido.minuto && (
          <div className="flex justify-center mt-1.5">
            <span className="text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded-full font-bold animate-pulse">
              {partido.minuto}
            </span>
          </div>
        )}

        {/* Fecha / hora y estadio — siempre visible */}
        <div className="mt-2 space-y-1">
          {partido.estado === "PROXIMO" && (
            <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
              <span>{partido.fecha}</span>
              {partido.horaIsrael && (
                <span className="text-river-red font-semibold">{partido.horaIsrael}</span>
              )}
            </div>
          )}
          {partido.estadio && (
            <div className="flex items-center justify-center gap-1 text-[10px] text-gray-500">
              <span>🏟</span>
              <span className="truncate">{partido.estadio}</span>
            </div>
          )}
        </div>

        {/* Contenido expandido */}
        {expandido && (
          <div className="mt-3 border-t border-white/10 pt-3 space-y-3" onClick={(e) => e.stopPropagation()}>

            {/* Info extra: fecha/hora en resultado o en vivo */}
            {partido.estado !== "PROXIMO" && (partido.fecha || partido.horaIsrael) && (
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                {partido.fecha && <span>{partido.fecha}</span>}
                {partido.horaIsrael && (
                  <span className="text-gray-500">{partido.horaIsrael}</span>
                )}
              </div>
            )}

            {/* Goles */}
            {partido.goles.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Goles</p>
                {partido.goles.map((g, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-300">
                    <span className="text-gray-500 w-6 text-right tabular-nums">{g.minuto}'</span>
                    <span className="text-river-red">⚽</span>
                    <span className={g.esRiver ? "text-white font-semibold" : "text-gray-400"}>
                      {g.jugador}
                    </span>
                    {g.esRiver && <span className="text-[9px] text-river-red font-bold ml-auto">RIVER</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Formaciones */}
            {tieneFormaciones && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowFormaciones(true); }}
                className="w-full text-xs font-bold text-river-red border border-river-red/40 rounded-lg py-1.5 hover:bg-river-red/10 transition-colors"
              >
                Ver Posibles Formaciones
              </button>
            )}

            {/* Hint si no hay nada extra */}
            {partido.goles.length === 0 && !tieneFormaciones && (
              <p className="text-center text-[10px] text-gray-600">Sin datos adicionales aún</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
