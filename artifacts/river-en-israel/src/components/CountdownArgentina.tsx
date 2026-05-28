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
      <div className="relative">
        {/* Brillo dorado de fondo */}
        <div className="absolute inset-0 bg-arg-dorado/20 rounded-2xl blur-xl" />
        <motion.div
          key={value}
          initial={{ scale: 1.15, opacity: 0, rotateX: -25 }}
          animate={{ scale: 1, opacity: 1, rotateX: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative bg-gradient-to-br from-[#1a3559] via-arg-celeste to-[#4a82b7] text-white font-display text-4xl md:text-6xl font-black tabular-nums w-[68px] h-[68px] md:w-28 md:h-28 rounded-2xl flex items-center justify-center shadow-[0_10px_40px_-5px_rgba(0,0,0,0.5)] border border-white/25"
          style={{ textShadow: "0 2px 0 rgba(0,0,0,0.4), 0 0 24px rgba(241,184,45,0.35)" }}
        >
          {/* Línea brillante superior (efecto scoreboard) */}
          <span className="absolute top-0 left-2 right-2 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          {/* Línea divisoria media (efecto flip) */}
          <span className="absolute left-1 right-1 top-1/2 h-px bg-black/20" />
          {String(value).padStart(2, "0")}
        </motion.div>
      </div>
      <span className="text-arg-dorado text-[10px] md:text-xs uppercase tracking-[0.22em] font-bold mt-3">
        {label}
      </span>
    </div>
  );

  return (
    <div className="relative bg-gradient-to-br from-arg-celeste/15 via-[#0a1628]/40 to-arg-dorado/15 border-2 border-arg-dorado/50 rounded-3xl p-6 md:p-10 backdrop-blur-sm overflow-hidden">
      {/* Línea dorada superior tipo broadcast */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-arg-dorado to-transparent" />
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
          <div className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-1.5 rounded-full font-bold uppercase tracking-widest text-xs mb-4 animate-pulse-celeste">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            EN VIVO
          </div>
          <p className="text-4xl md:text-6xl font-display font-black text-arg-dorado animate-pulse leading-none">
            ¡SE JUEGA!
          </p>
          <p className="text-white/80 mt-3 text-base md:text-lg font-semibold tracking-wide">VAMOS ARGENTINA</p>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 md:gap-4">
          <Box value={r.days}  label="Días" />
          <span className="text-arg-dorado/40 text-3xl md:text-5xl font-light pb-6 select-none">:</span>
          <Box value={r.hours} label="Horas" />
          <span className="text-arg-dorado/40 text-3xl md:text-5xl font-light pb-6 select-none">:</span>
          <Box value={r.mins}  label="Min" />
          <span className="text-arg-dorado/40 text-3xl md:text-5xl font-light pb-6 select-none">:</span>
          <Box value={r.secs}  label="Seg" />
        </div>
      )}
    </div>
  );
}
