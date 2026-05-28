import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { proximoPartidoArgentina, formatearHoraIsrael, estadioPorId } from "@/lib/mundial-data";

function calcRemaining(targetMs: number, nowMs: number) {
  const diff = Math.max(0, targetMs - nowMs);
  const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins  = Math.floor((diff / (1000 * 60)) % 60);
  const secs  = Math.floor((diff / 1000) % 60);
  return { days, hours, mins, secs, done: diff === 0 };
}

export function CountdownArgentina() {
  const partido = proximoPartidoArgentina();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!partido) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [partido]);

  if (!partido) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
        <p className="text-white/70 text-sm">Próximo partido de Argentina por confirmar</p>
      </div>
    );
  }

  const target = new Date(partido.kickoffUTC).getTime();
  const r = calcRemaining(target, now);
  const estadio = estadioPorId(partido.estadioId);

  const Box = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <motion.div
        key={value}
        initial={{ scale: 1.15, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="bg-gradient-to-br from-arg-celeste to-[#5b8fc4] text-white font-display text-4xl md:text-6xl font-bold tabular-nums w-16 h-16 md:w-24 md:h-24 rounded-2xl flex items-center justify-center shadow-2xl border border-white/20"
      >
        {String(value).padStart(2, "0")}
      </motion.div>
      <span className="text-arg-dorado text-[10px] md:text-xs uppercase tracking-widest font-bold mt-2">
        {label}
      </span>
    </div>
  );

  return (
    <div className="bg-gradient-to-br from-arg-celeste/10 to-arg-dorado/10 border-2 border-arg-dorado/40 rounded-3xl p-6 md:p-10 backdrop-blur-sm">
      <div className="text-center mb-6">
        <span className="inline-block bg-arg-dorado text-[#1a1a1a] text-[10px] md:text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3">
          {partido.fase} · Grupo {partido.grupo}
        </span>
        <h3 className="text-2xl md:text-4xl font-display font-bold text-white mb-2">
          <span className="text-arg-celeste">{partido.local.bandera} {partido.local.nombre}</span>
          <span className="text-white/60 mx-3 text-xl md:text-2xl">vs</span>
          <span className="text-arg-celeste">{partido.visitante.nombre} {partido.visitante.bandera}</span>
        </h3>
        <p className="text-white/70 text-sm md:text-base">{formatearHoraIsrael(partido.kickoffUTC)} (hora Israel)</p>
        {estadio && (
          <p className="text-white/50 text-xs md:text-sm mt-1 flex items-center justify-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {estadio.nombre} · {estadio.ciudad}
          </p>
        )}
      </div>

      {r.done ? (
        <div className="text-center py-6">
          <p className="text-4xl md:text-6xl font-display font-bold text-arg-dorado animate-pulse">
            ¡EN JUEGO!
          </p>
          <p className="text-white/80 mt-2">Vamos Argentina 🇦🇷</p>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3 md:gap-5">
          <Box value={r.days}  label="Días" />
          <span className="text-arg-dorado/50 text-3xl md:text-5xl font-light pb-6">:</span>
          <Box value={r.hours} label="Horas" />
          <span className="text-arg-dorado/50 text-3xl md:text-5xl font-light pb-6">:</span>
          <Box value={r.mins}  label="Min" />
          <span className="text-arg-dorado/50 text-3xl md:text-5xl font-light pb-6">:</span>
          <Box value={r.secs}  label="Seg" />
        </div>
      )}
    </div>
  );
}
