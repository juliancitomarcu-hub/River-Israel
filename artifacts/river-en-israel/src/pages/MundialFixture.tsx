import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowLeft, MapPin, Trophy, RefreshCw } from "lucide-react";
import { SolDeMayo } from "@/components/SolDeMayo";
import {
  FIXTURE_ARGENTINA,
  FIXTURE_GRUPO_J,
  TABLA_GRUPO_J_INICIAL,
  GRUPO_ARGENTINA,
  EQ,
  estadioPorId,
  formatearHoraIsrael,
  type Equipo,
  type FilaTabla,
  type PartidoMundial,
} from "@/lib/mundial-data";

type Estado = "PROXIMO" | "EN_VIVO" | "FINALIZADO";

type Resultado = {
  golesLocal: number | null;
  golesVisitante: number | null;
  estado: Estado;
  minuto?: string;
  notas?: string;
  actualizadoEn?: string;
};

type ResultadosMap = Record<string, Resultado>;

const REFRESH_MS = 30_000;

function calcularTabla(partidos: PartidoMundial[], resultados: ResultadosMap): FilaTabla[] {
  // Inicializar con todos los equipos presentes en el grupo (a partir de la tabla inicial,
  // así mantenemos el orden alfabético/canónico cuando todavía no hay puntos).
  const stats = new Map<string, FilaTabla>();
  for (const fila of TABLA_GRUPO_J_INICIAL) {
    stats.set(fila.equipo.code, {
      equipo: fila.equipo,
      pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0,
    });
  }

  for (const p of partidos) {
    const r = resultados[p.id];
    if (!r || r.estado !== "FINALIZADO") continue;
    if (r.golesLocal == null || r.golesVisitante == null) continue;
    const local = stats.get(p.local.code);
    const visit = stats.get(p.visitante.code);
    if (!local || !visit) continue;

    local.pj += 1; visit.pj += 1;
    local.gf += r.golesLocal; local.gc += r.golesVisitante;
    visit.gf += r.golesVisitante; visit.gc += r.golesLocal;
    if (r.golesLocal > r.golesVisitante) {
      local.pg += 1; local.pts += 3; visit.pp += 1;
    } else if (r.golesLocal < r.golesVisitante) {
      visit.pg += 1; visit.pts += 3; local.pp += 1;
    } else {
      local.pe += 1; visit.pe += 1; local.pts += 1; visit.pts += 1;
    }
  }

  return Array.from(stats.values()).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const dg = (b.gf - b.gc) - (a.gf - a.gc);
    if (dg !== 0) return dg;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.equipo.nombre.localeCompare(b.equipo.nombre);
  });
}

function badgeEstado(estado: Estado, minuto?: string): { texto: string; cls: string } {
  if (estado === "EN_VIVO") {
    return {
      texto: minuto ? `EN VIVO · ${minuto}` : "EN VIVO",
      cls: "bg-red-500/90 text-white animate-pulse",
    };
  }
  if (estado === "FINALIZADO") {
    return { texto: "FINAL", cls: "bg-white/15 text-white/80" };
  }
  return { texto: "PRÓXIMO", cls: "bg-arg-dorado/20 text-arg-dorado" };
}

export default function MundialFixture() {
  const [resultados, setResultados] = useState<ResultadosMap>({});
  const [cargando, setCargando] = useState(true);
  const [errorFetch, setErrorFetch] = useState<string | null>(null);
  const [actualizadoEn, setActualizadoEn] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("river_admin_session") ?? localStorage.getItem("admin_token") ?? "";
  });

  // Fetch + auto-refresh cada 30s
  useEffect(() => {
    let activo = true;
    let timer: number | undefined;

    const fetchResultados = async () => {
      try {
        const res = await fetch("/api/mundial/resultados", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { resultados: ResultadosMap; actualizadoEn: string };
        if (!activo) return;
        setResultados(data.resultados ?? {});
        setActualizadoEn(data.actualizadoEn);
        setErrorFetch(null);
      } catch (err) {
        if (!activo) return;
        setErrorFetch(err instanceof Error ? err.message : "Error al cargar resultados");
      } finally {
        if (activo) setCargando(false);
      }
    };

    fetchResultados();
    timer = window.setInterval(fetchResultados, REFRESH_MS);
    return () => {
      activo = false;
      if (timer) window.clearInterval(timer);
    };
  }, []);

  // Agrupar por jornada
  const jornadas = useMemo(() => {
    const map = new Map<number, PartidoMundial[]>();
    for (const p of FIXTURE_GRUPO_J) {
      const j = p.jornada ?? 0;
      const list = map.get(j) ?? [];
      list.push(p);
      map.set(j, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, []);

  // Tabla recalculada en vivo
  const tabla = useMemo(
    () => calcularTabla(FIXTURE_GRUPO_J, resultados),
    [resultados],
  );

  const algunFinalizado = useMemo(
    () => Object.values(resultados).some(r => r.estado === "FINALIZADO"),
    [resultados],
  );

  const debutPartido = FIXTURE_ARGENTINA[0]!;
  const debutTxt = formatearHoraIsrael(debutPartido.kickoffUTC);
  const debutRival = debutPartido.local.code === "ARG" ? debutPartido.visitante : debutPartido.local;
  const debutEstadio = estadioPorId(debutPartido.estadioId);

  return (
    <div className="min-h-screen bg-[#0a1628] text-white pt-20">
      {/* Hero */}
      <section className="py-12 bg-gradient-to-br from-[#0a1628] via-[#103a5e] to-[#0a1628] border-b border-arg-celeste/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-arg-celeste hover:text-arg-dorado text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver al inicio
          </Link>
          <div className="flex items-center gap-3 mb-3">
            <SolDeMayo size={36} />
            <span className="bg-arg-dorado/20 text-arg-dorado border border-arg-dorado/40 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest inline-block">
              Grupo {GRUPO_ARGENTINA} · Mundial 2026
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-black leading-[0.95] text-shadow-cinema">
            FIXTURE DE LA <span className="text-arg-celeste">SCALONETA</span>
          </h1>
          <p className="text-white/70 text-sm md:text-base mt-3 max-w-2xl">
            Todos los partidos del Grupo {GRUPO_ARGENTINA} en hora Israel (IDT, UTC+3). Argentina debuta vs {debutRival.nombre}
            {debutEstadio ? ` en el ${debutEstadio.nombre}` : ""}: <span className="text-arg-dorado font-semibold">{debutTxt}</span> hora Israel.
          </p>
          {actualizadoEn && (
            <p className="text-white/40 text-[11px] mt-3 flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3" />
              Resultados actualizados {new Date(actualizadoEn).toLocaleTimeString("es-AR", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" })} (Israel) · auto-refresh cada 30s
            </p>
          )}
          {errorFetch && (
            <p className="text-red-300 text-[11px] mt-2">No se pudieron cargar los resultados en vivo: {errorFetch}</p>
          )}
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
                {tabla.map((fila, i) => {
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
            {algunFinalizado
              ? "Tabla calculada en vivo a partir de los resultados publicados."
              : "Tabla en estado inicial. Se actualizará automáticamente cuando se carguen los resultados."}
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
                    const r = resultados[p.id];
                    const estado: Estado = r?.estado ?? "PROXIMO";
                    const badge = badgeEstado(estado, r?.minuto);
                    const mostrarScore = estado !== "PROXIMO" && r?.golesLocal != null && r?.golesVisitante != null;

                    return (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.05 }}
                        className={`relative rounded-2xl p-5 border transition-all overflow-hidden ${
                          estado === "EN_VIVO"
                            ? "bg-gradient-to-r from-red-500/10 via-arg-celeste/10 to-arg-dorado/10 border-red-400/60 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
                            : esArg
                              ? "bg-gradient-to-r from-arg-celeste/15 via-arg-celeste/5 to-arg-dorado/10 border-arg-celeste/50 shadow-[0_0_30px_rgba(116,172,223,0.25)]"
                              : "bg-white/5 border-white/10 hover:border-white/25"
                        }`}
                      >
                        {esArg && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-arg-celeste via-arg-dorado to-arg-celeste" />
                        )}

                        {/* Badge estado (esquina sup. derecha) */}
                        <div className="absolute top-3 right-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badge.cls}`}>
                            {badge.texto}
                          </span>
                        </div>

                        <div className="flex items-center justify-between flex-wrap gap-3 mt-2">
                          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-[280px]">
                            <div className="flex items-center gap-2 flex-1 justify-end">
                              <span className={`font-bold text-sm md:text-base ${esArg && p.local.code === EQ.ARG.code ? "text-arg-celeste" : "text-white"}`}>
                                {p.local.nombre}
                              </span>
                              <span className="text-3xl md:text-4xl drop-shadow-lg">{p.local.bandera}</span>
                            </div>

                            {mostrarScore ? (
                              <div className="flex items-center gap-2 px-3">
                                <span className="text-3xl md:text-4xl font-display font-black text-white tabular-nums">
                                  {r!.golesLocal}
                                </span>
                                <span className="text-white/40 text-lg">·</span>
                                <span className="text-3xl md:text-4xl font-display font-black text-white tabular-nums">
                                  {r!.golesVisitante}
                                </span>
                              </div>
                            ) : (
                              <span className="text-arg-dorado font-display font-black text-xl md:text-2xl px-2 md:px-3 select-none">VS</span>
                            )}

                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-3xl md:text-4xl drop-shadow-lg">{p.visitante.bandera}</span>
                              <span className={`font-bold text-sm md:text-base ${esArg && p.visitante.code === EQ.ARG.code ? "text-arg-celeste" : "text-white"}`}>
                                {p.visitante.nombre}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-arg-dorado font-bold text-sm">{formatearHoraIsrael(p.kickoffUTC)}</div>
                            <div className="text-white/50 text-[11px] flex items-center gap-1 justify-end mt-0.5">
                              <MapPin className="w-3 h-3" />
                              {estadio?.nombre ?? p.estadioId} · {estadio?.ciudad}
                            </div>
                          </div>
                        </div>

                        {r?.notas && (
                          <p className="text-white/60 text-xs mt-3 italic border-t border-white/10 pt-2">{r.notas}</p>
                        )}
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

      {/* Admin: edición rápida de resultados (solo si hay token) */}
      {adminToken && (
        <AdminResultadosPanel
          partidos={FIXTURE_GRUPO_J}
          resultados={resultados}
          adminToken={adminToken}
          onSaved={(id, r) => setResultados(prev => ({ ...prev, [id]: r }))}
          onLogout={() => {
            localStorage.removeItem("admin_token");
            setAdminToken("");
          }}
        />
      )}
      {cargando && (
        <div className="text-center text-white/30 text-xs pb-6">Cargando resultados…</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel admin inline — solo visible si hay x-admin-token en localStorage
// ─────────────────────────────────────────────────────────────────────────────

function AdminResultadosPanel({
  partidos,
  resultados,
  adminToken,
  onSaved,
  onLogout,
}: {
  partidos: PartidoMundial[];
  resultados: ResultadosMap;
  adminToken: string;
  onSaved: (id: string, r: Resultado) => void;
  onLogout: () => void;
}) {
  return (
    <section className="py-12 bg-black/40 border-t border-arg-dorado/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-display font-bold text-arg-dorado">⚙️ Admin · Editar resultados</h2>
          <button
            onClick={onLogout}
            className="text-white/40 hover:text-white text-xs underline"
          >
            Cerrar sesión
          </button>
        </div>
        <p className="text-white/50 text-xs mb-6">
          Carga goles y estado por partido. Los cambios se reflejan en la tabla automáticamente. Estado "EN VIVO" hace parpadear la tarjeta en rojo.
        </p>
        <div className="space-y-3">
          {partidos.map(p => (
            <AdminFilaPartido
              key={p.id}
              partido={p}
              actual={resultados[p.id]}
              adminToken={adminToken}
              onSaved={onSaved}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function AdminFilaPartido({
  partido,
  actual,
  adminToken,
  onSaved,
}: {
  partido: PartidoMundial;
  actual?: Resultado;
  adminToken: string;
  onSaved: (id: string, r: Resultado) => void;
}) {
  const [golesLocal, setGL] = useState<string>(actual?.golesLocal?.toString() ?? "");
  const [golesVisitante, setGV] = useState<string>(actual?.golesVisitante?.toString() ?? "");
  const [estado, setEstado] = useState<Estado>(actual?.estado ?? "PROXIMO");
  const [minuto, setMinuto] = useState<string>(actual?.minuto ?? "");
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const guardar = async () => {
    setGuardando(true);
    setMsg("");
    try {
      const body: Resultado = {
        golesLocal: golesLocal === "" ? null : Number(golesLocal),
        golesVisitante: golesVisitante === "" ? null : Number(golesVisitante),
        estado,
        minuto: minuto || undefined,
      };
      const res = await fetch(`/api/mundial/resultado/${partido.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      onSaved(partido.id, data.resultado);
      setMsg("✓ Guardado");
      setTimeout(() => setMsg(""), 2000);
    } catch (err) {
      setMsg("Error: " + (err instanceof Error ? err.message : "desconocido"));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 min-w-[200px] flex-1">
        <span className="text-xl">{partido.local.bandera}</span>
        <span className="font-bold text-sm">{partido.local.nombre}</span>
        <span className="text-white/40 text-xs px-1">vs</span>
        <span className="font-bold text-sm">{partido.visitante.nombre}</span>
        <span className="text-xl">{partido.visitante.bandera}</span>
      </div>
      <input
        type="number"
        min={0}
        max={20}
        placeholder="—"
        value={golesLocal}
        onChange={e => setGL(e.target.value)}
        className="w-14 bg-black/40 border border-white/20 rounded px-2 py-1 text-center text-sm"
      />
      <span className="text-white/40">:</span>
      <input
        type="number"
        min={0}
        max={20}
        placeholder="—"
        value={golesVisitante}
        onChange={e => setGV(e.target.value)}
        className="w-14 bg-black/40 border border-white/20 rounded px-2 py-1 text-center text-sm"
      />
      <select
        value={estado}
        onChange={e => setEstado(e.target.value as Estado)}
        className="bg-black/40 border border-white/20 rounded px-2 py-1 text-xs"
      >
        <option value="PROXIMO">Próximo</option>
        <option value="EN_VIVO">En vivo</option>
        <option value="FINALIZADO">Finalizado</option>
      </select>
      {estado === "EN_VIVO" && (
        <input
          type="text"
          placeholder="ej: 73'"
          value={minuto}
          onChange={e => setMinuto(e.target.value)}
          className="w-20 bg-black/40 border border-white/20 rounded px-2 py-1 text-xs"
        />
      )}
      <button
        onClick={guardar}
        disabled={guardando}
        className="bg-arg-celeste hover:bg-arg-celeste/80 disabled:opacity-50 text-[#0a1628] font-bold px-3 py-1 rounded text-xs"
      >
        {guardando ? "..." : "Guardar"}
      </button>
      {msg && <span className="text-xs text-arg-dorado">{msg}</span>}
    </div>
  );
}
