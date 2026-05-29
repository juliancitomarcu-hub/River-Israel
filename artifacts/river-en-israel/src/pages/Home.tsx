import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Calendar, Trophy, ChevronRight, CheckCircle2, ChevronDown, Send, AlertCircle, X, ChevronLeft, Download, ZoomIn, Bell, Mail, Phone, MapPin, Car, Shirt, Clock } from "lucide-react";
import { useNews, useMatches, useHistoryTimeline } from "@/hooks/use-river-data";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import ProximoPartidoWidget from "@/components/ProximoPartidoWidget";
import ShareButton from "@/components/ShareButton";
import CredencialGenerador from "@/components/CredencialGenerador";

interface GaleriaFoto {
  id: number;
  url: string;
  caption: string;
  orden: number;
}

interface VideoGaleria {
  id: number;
  url: string;
  titulo: string;
  thumbnail: string | null;
  orden: number;
}

const suscripSchema = z.object({
  nombre: z.string().min(2, "Ingresá tu nombre"),
  email: z.string().email("Email inválido"),
  telefono: z.string().optional(),
  ciudad: z.string().optional(),
});
type SuscripValues = z.infer<typeof suscripSchema>;

export default function Home() {
  const [mostrarCredencial, setMostrarCredencial] = useState(false);
  const [suscripEstado, setSuscripEstado] = useState<"idle" | "enviando" | "ok" | "error">("idle");
  const [suscripError, setSuscripError] = useState("");
  const [canales, setCanales] = useState<string[]>(["email", "whatsapp"]);

  // Videos
  const [videos, setVideos] = useState<VideoGaleria[]>([]);
  const [videoAbierto, setVideoAbierto] = useState<VideoGaleria | null>(null);
  useEffect(() => {
    fetch("/api/videos?categoria=river", { cache: "no-store" })
      .then(r => r.json())
      .then((d: { videos?: VideoGaleria[] }) => setVideos(d.videos ?? []))
      .catch(() => {/* silencioso */});
  }, []);

  // Galería
  const [galeriaFotos, setGaleriaFotos] = useState<GaleriaFoto[]>([]);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [paginaGaleria, setPaginaGaleria] = useState(0);
  const COLS = 4;
  const ROWS = 3;
  const PAGE_SIZE = COLS * ROWS;
  const totalPaginas = Math.max(1, Math.ceil(galeriaFotos.length / PAGE_SIZE));
  const dragStartX = useRef<number | null>(null);

  useEffect(() => {
    fetch("/api/galeria?categoria=river", { cache: "no-store" })
      .then(r => r.json())
      .then((d: { fotos?: GaleriaFoto[] }) => setGaleriaFotos(d.fotos ?? []))
      .catch(() => {/* silencioso */});
  }, []);

  const abrirLightbox = (idx: number) => setLightboxIdx(idx);
  const cerrarLightbox = () => setLightboxIdx(null);
  const irAnterior = useCallback(() => setLightboxIdx(i => i !== null ? (i - 1 + galeriaFotos.length) % galeriaFotos.length : null), [galeriaFotos.length]);
  const irSiguiente = useCallback(() => setLightboxIdx(i => i !== null ? (i + 1) % galeriaFotos.length : null), [galeriaFotos.length]);

  useEffect(() => {
    if (lightboxIdx === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") irAnterior();
      if (e.key === "ArrowRight") irSiguiente();
      if (e.key === "Escape") cerrarLightbox();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIdx, irAnterior, irSiguiente]);

  function resolverUrl(url: string) {
    if (url.startsWith("/objects/")) return `/api/storage/objects${url.slice(8)}`;
    if (url.startsWith("/images/")) return `${import.meta.env.BASE_URL}${url.slice(1)}`;
    return url;
  }

  const [paginaActualidad, setPaginaActualidad] = useState(0);
  const { data: newsData } = useNews(paginaActualidad);
  const news = newsData?.items;
  const totalPaginasNoticias = newsData?.totalPages ?? 1;
  const { data: matches } = useMatches();
  const { data: timeline } = useHistoryTimeline();

  const { register: regS, handleSubmit: handleS, formState: { errors: errS } } = useForm<SuscripValues>({
    resolver: zodResolver(suscripSchema),
  });

  function toggleCanal(c: string) {
    setCanales(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  async function onSubmitSuscrip(data: SuscripValues) {
    if (canales.length === 0) {
      setSuscripError("Elegí al menos un canal para recibir noticias");
      setSuscripEstado("error");
      return;
    }
    setSuscripEstado("enviando");
    setSuscripError("");
    try {
      const res = await fetch("/api/suscribir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, canales }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) { setSuscripError(json.error ?? "Error al enviar"); setSuscripEstado("error"); }
      else setSuscripEstado("ok");
    } catch { setSuscripError("Error de conexión"); setSuscripEstado("error"); }
  }

  const fadeIn = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } }
  };

  return (
    <>
    <div className="w-full bg-background overflow-hidden">

      {/* ================= HERO / PORTADA ================= */}
      <section className="relative w-full bg-river-black overflow-hidden" style={{ aspectRatio: "1200/420", maxHeight: "520px", minHeight: "260px" }}>
        {/* Banner de portada */}
        <img
          src={`${import.meta.env.BASE_URL}images/hero-monumental.png?v=2`}
          alt="Portada River en Israel"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />

        {/* Layout: texto izquierda, escudo derecha */}
        <div className="absolute inset-0 z-10 flex items-end justify-between px-6 sm:px-10 md:px-16 pb-5 sm:pb-7 bg-gradient-to-t from-black/75 via-black/20 to-transparent">

          {/* Texto — izquierda */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-col max-w-[58%]"
          >
            <p className="text-[11px] sm:text-sm md:text-base text-gray-100 mb-4 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] font-medium leading-snug">
              La Banda del Millonario,<br />
              latiendo fuerte desde Tierra Santa.<br />
              La misma pasión a miles de kilómetros.
            </p>
            <div className="flex flex-row flex-wrap gap-2">
              <a
                href="https://chat.whatsapp.com/LGMvmF1bKjJ2PlZ1GqCfo0"
                target="_blank"
                rel="noopener noreferrer"
                className="whitespace-nowrap px-4 py-2 bg-white text-river-red font-bold rounded-full text-xs uppercase tracking-wide hover:bg-gray-100 transition-all hover:scale-105"
              >
                Súmate a la Filial
              </a>
              <div className="flex gap-2">
                <a href="#actualidad" className="whitespace-nowrap px-4 py-2 bg-river-red text-white font-bold rounded-full text-xs uppercase tracking-wide hover:bg-river-red-hover transition-all shadow-[0_0_12px_rgba(204,0,0,0.5)]">
                  Últimas Noticias
                </a>
                <a href="#suscribite" className="whitespace-nowrap px-4 py-2 bg-white text-river-red font-bold rounded-full text-xs uppercase tracking-wide hover:bg-gray-100 transition-all">
                  Recibí Noticias
                </a>
              </div>
            </div>
          </motion.div>

          {/* Escudos — derecha (filial + CARP) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="relative flex-shrink-0 self-center flex items-center gap-1 sm:gap-4"
          >
            <div className="absolute inset-0 bg-river-red/20 blur-3xl rounded-full scale-110" />
            <img
              src={`${import.meta.env.BASE_URL}filial-logo.jpeg`}
              alt="Escudo Filial River Plate Israel - Gaby El Tucu Sajnin"
              className="relative z-10 w-14 h-14 sm:w-36 sm:h-36 md:w-48 md:h-48 object-contain rounded-full"
              style={{ filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.7))" }}
              draggable={false}
            />
            <img
              src={`${import.meta.env.BASE_URL}images/escudo-carp.png?v=4`}
              alt="Escudo Club Atlético River Plate"
              className="relative z-10 w-16 h-16 sm:w-44 sm:h-44 md:w-56 md:h-56 object-contain"
              style={{ filter: "drop-shadow(0 4px 28px rgba(204,0,0,0.9))" }}
              draggable={false}
            />
          </motion.div>
        </div>

        {/* Línea roja inferior */}
        <div className="absolute bottom-0 inset-x-0 h-1 bg-river-red z-20" />
      </section>

      {/* ================= ACTUALIDAD SECTION ================= */}
      <section id="actualidad" className="bg-[#111] relative">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-river-red to-transparent z-10"></div>

        {/* Header con foto de fondo */}
        <div className="relative overflow-hidden">
          <img
            src={`${import.meta.env.BASE_URL}images/estadio-river.jpeg`}
            alt="Estadio Monumental"
            className="absolute inset-0 w-full h-full object-cover object-center"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/15 to-[#111]" />
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
              <div>
                <h2 className="text-4xl md:text-5xl font-display font-bold text-white">Actualidad <span className="text-river-red">Millonaria</span></h2>
                <p className="text-gray-300 mt-2 text-lg">Lo último del mundo River y nuestra filial.</p>
                <div className="flex flex-wrap gap-3 mt-4">
                  <a
                    href="https://www.instagram.com/riverplateisr?igsh=ZGRpbXlhZnpsdjB5"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-river-red text-river-red hover:bg-river-red hover:text-white px-5 py-2 text-sm font-bold uppercase tracking-wide transition-all"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                    Nuestro Instagram
                  </a>
                  <a
                    href="https://www.facebook.com/share/1ANhvcjefr/?mibextid=wwXIfr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-river-red text-river-red hover:bg-river-red hover:text-white px-5 py-2 text-sm font-bold uppercase tracking-wide transition-all"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    Nuestro Facebook
                  </a>
                </div>
              </div>
              <div className="flex-shrink-0">
                <ProximoPartidoWidget />
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* News List — compact horizontal cards */}
            <div className="lg:col-span-2 flex flex-col gap-3">
              {news?.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: "-60px" }}
                  variants={fadeIn}
                >
                  <div className="group bg-white rounded-xl overflow-hidden shadow border border-gray-100 hover:shadow-md transition-all duration-300">
                    <Link href={`/noticia/${item.id}`} className="flex gap-0">
                      <div className="relative overflow-hidden w-32 md:w-44 flex-shrink-0">
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          style={{ minHeight: "100px" }}
                        />
                      </div>
                      <div className="p-3 flex-1 flex flex-col justify-between min-w-0">
                        <div>
                          <span className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                            <Calendar className="w-3 h-3" /> {item.date}
                          </span>
                          <h3 className="font-display font-bold text-river-black group-hover:text-river-red transition-colors text-sm md:text-base leading-snug line-clamp-2">
                            {item.title}
                          </h3>
                          <p className="text-gray-500 text-xs line-clamp-2 mt-1 hidden md:block">{item.excerpt}</p>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="inline-flex items-center gap-1 text-river-red text-xs font-bold group-hover:gap-2 transition-all">
                            Leer más <ChevronRight className="w-3 h-3" />
                          </span>
                          <ShareButton titulo={item.title} id={item.id} />
                        </div>
                      </div>
                    </Link>
                  </div>
                </motion.div>
              ))}

              {/* ── Paginación Actualidad ── */}
              {totalPaginasNoticias > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
                  <button
                    onClick={() => { setPaginaActualidad(p => Math.max(0, p - 1)); window.location.hash = "actualidad"; }}
                    disabled={paginaActualidad === 0}
                    className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:border-river-red hover:text-river-red disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-bold"
                    aria-label="Página anterior"
                  >
                    ‹
                  </button>

                  {Array.from({ length: totalPaginasNoticias }, (_, i) => i).map(i => (
                    <button
                      key={i}
                      onClick={() => { setPaginaActualidad(i); window.location.hash = "actualidad"; }}
                      className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold transition-all border ${
                        i === paginaActualidad
                          ? "bg-river-red text-white border-river-red shadow"
                          : "border-gray-200 text-gray-500 hover:border-river-red hover:text-river-red"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}

                  <button
                    onClick={() => { setPaginaActualidad(p => Math.min(totalPaginasNoticias - 1, p + 1)); window.location.hash = "actualidad"; }}
                    disabled={paginaActualidad === totalPaginasNoticias - 1}
                    className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:border-river-red hover:text-river-red disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-bold"
                    aria-label="Página siguiente"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>

            {/* Matches Sidebar */}
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={fadeIn}
              className="bg-river-black rounded-2xl p-4 shadow-2xl text-white relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-river-red blur-[60px] rounded-full opacity-40"></div>

              <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2 relative z-10">
                <Trophy className="w-4 h-4 text-river-red" /> Fixture y Resultados
              </h3>

              <div className="space-y-2 relative z-10">
                {!matches && (
                  <div className="flex justify-center py-6">
                    <div className="w-6 h-6 border-2 border-river-red border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {matches && (() => {
                  const proximos = matches.filter(m => m.status === 'UPCOMING').slice(0, 2);
                  const jugados = matches.filter(m => m.status === 'FINISHED' || m.status === 'LIVE').slice(0, 2);
                  return [...jugados, ...proximos];
                })().map((match) => {
                  const [golesRiver, golesRival] = match.isRiverHome
                    ? [match.homeScore, match.awayScore]
                    : [match.awayScore, match.homeScore];
                  const ganamos = match.status === 'FINISHED' && golesRiver !== null && golesRival !== null && golesRiver > golesRival;
                  const perdimos = match.status === 'FINISHED' && golesRiver !== null && golesRival !== null && golesRiver < golesRival;
                  const empate = match.status === 'FINISHED' && golesRiver !== null && golesRival !== null && golesRiver === golesRival;

                  return (
                    <div key={match.id} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 hover:bg-white/10 transition-colors">
                      <div className="flex justify-between items-center text-[10px] text-gray-400 mb-1">
                        <span className="font-semibold text-gray-300 truncate max-w-[120px]">{match.competition}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {match.status === 'LIVE' && (
                            <span className="flex items-center gap-0.5 bg-green-500 text-white px-1 py-0.5 rounded text-[9px] font-bold animate-pulse">
                              🔴 EN VIVO
                            </span>
                          )}
                          {match.status === 'FINISHED' && (
                            <span className={cn(
                              "px-1 py-0.5 rounded text-[9px] font-bold",
                              ganamos ? "bg-green-600 text-white" : perdimos ? "bg-red-700 text-white" : "bg-gray-600 text-white"
                            )}>
                              {ganamos ? "✓ Ganamos" : perdimos ? "✗ Perdimos" : "= Empate"}
                            </span>
                          )}
                          <span>{match.date}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Local */}
                        <div className="flex-1 min-w-0">
                          <div className={cn("font-bold text-xs truncate leading-tight", match.isRiverHome ? "text-white" : "text-gray-400")}>
                            {match.homeTeam}
                          </div>
                          {(match.status === 'FINISHED' || match.status === 'LIVE') && (
                            <div className={cn("font-display text-xl font-bold tabular-nums leading-none mt-0.5", match.isRiverHome ? "text-white" : "text-gray-400")}>
                              {match.homeScore ?? 0}
                            </div>
                          )}
                        </div>
                        {/* Separador */}
                        <div className="flex-shrink-0 text-gray-500 text-xs font-bold">
                          {match.status === 'FINISHED' || match.status === 'LIVE' ? '—' : 'vs'}
                        </div>
                        {/* Visitante */}
                        <div className="flex-1 min-w-0 text-right">
                          <div className={cn("font-bold text-xs truncate leading-tight", !match.isRiverHome ? "text-white" : "text-gray-400")}>
                            {match.awayTeam}
                          </div>
                          {(match.status === 'FINISHED' || match.status === 'LIVE') && (
                            <div className={cn("font-display text-xl font-bold tabular-nums leading-none mt-0.5", !match.isRiverHome ? "text-white" : "text-gray-400")}>
                              {match.awayScore ?? 0}
                            </div>
                          )}
                        </div>
                      </div>

                      {match.status === 'UPCOMING' && match.horaIsrael && (
                        <p className="text-[10px] text-river-red font-semibold mt-1 text-center">
                          ⏰ {match.horaIsrael}
                        </p>
                      )}
                      {match.estadio && (
                        <p className="text-[9px] text-gray-500 mt-0.5 text-center">
                          🏟 {match.estadio}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <Link href="/fixture" className="w-full mt-3 flex items-center justify-center bg-white text-river-black hover:bg-gray-100 font-bold py-2 rounded-lg transition-colors relative z-10 text-xs">
                Fixture Completo
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ================= PRÓXIMOS EVENTOS SECTION ================= */}
      <section id="eventos" className="py-16 bg-gradient-to-b from-river-black to-[#0a0a0a] text-white relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-river-red/10 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-10">
            <span className="bg-river-red/20 px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wide uppercase text-river-red border border-river-red/30 inline-block mb-4">
              Agenda de la Filial Ramat Gan
            </span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-3">
              Próximos <span className="text-river-red">Eventos</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Encuentros para ver partidos, asados millonarios, eventos sociales y todo lo que se viene para la familia riverplatense en Israel.
            </p>
          </div>

          <div className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-river-red/30 rounded-3xl overflow-hidden backdrop-blur shadow-2xl">
            {/* Header del evento */}
            <div className="bg-gradient-to-r from-river-red via-river-red to-[#a30000] p-6 md:p-7">
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-white/20 text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">Próximo evento</span>
                <span className="text-white/80 text-xs font-semibold">Convocatoria oficial</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-display font-bold text-white leading-tight">
                River Plate vs. Belgrano de Córdoba
              </h3>
              <p className="text-white/90 text-sm mt-1">Vení a ver el partido con la Filial Ramat Gan ⚪️🔴</p>
            </div>

            {/* Detalles */}
            <div className="p-6 md:p-8 grid sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-river-red mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Fecha</p>
                  <p className="text-white font-semibold">Domingo 24 de Mayo de 2026</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-river-red mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Convocatoria</p>
                  <p className="text-white font-semibold">21:00 hs (hora de Israel)</p>
                </div>
              </div>
              <div className="flex items-start gap-3 sm:col-span-2">
                <MapPin className="w-5 h-5 text-river-red mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Lugar</p>
                  <p className="text-white font-semibold">Meltzer Beer</p>
                  <p className="text-gray-400 text-sm">Merkaz Ben Gurion · Ben Gurion 4, Rishon LeZion</p>
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=Meltzer+Beer+Ben+Gurion+4+Rishon+LeZion"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 mt-1.5 text-river-red hover:text-white text-xs font-semibold transition-colors"
                  >
                    Ver en Google Maps <ChevronRight className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Car className="w-5 h-5 text-river-red mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Beneficio</p>
                  <p className="text-white font-semibold">Estacionamiento gratuito en el lugar</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shirt className="w-5 h-5 text-river-red mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Vestimenta</p>
                  <p className="text-white font-semibold">Camisetas, banderas y distintivos Rojos y Blancos</p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="px-6 pb-6 md:px-8 md:pb-8 flex flex-col sm:flex-row gap-3">
              <a
                href="https://chat.whatsapp.com/LGMvmF1bKjJ2PlZ1GqCfo0"
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold py-3 px-5 rounded-xl transition-all shadow-lg hover:-translate-y-0.5 text-sm"
              >
                Confirmar asistencia por WhatsApp
              </a>
              <a
                href="#suscribite"
                className="flex-1 inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white font-bold py-3 px-5 rounded-xl transition-all border border-white/20 text-sm"
              >
                <Bell className="w-4 h-4" /> Recibir avisos
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FILIAL RAMAT GAN SECTION ================= */}
      <section id="filial" className="py-24 bg-gray-50 relative overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-[0.03]">
          <img
            src={`${import.meta.env.BASE_URL}images/ramat-gan-bg.png`}
            alt="Ramat Gan Background"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col lg:flex-row">

            {/* Info Side */}
            <div className="lg:w-5/12 bg-river-black text-white p-10 lg:p-16 flex flex-col justify-center relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-river-red rounded-full blur-[100px] opacity-40"></div>

              <div className="mb-8">
                <span className="bg-white/10 px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wide uppercase text-river-red border border-river-red/30 whitespace-nowrap inline-block">
                  Objetivo de ser sede oficial en Israel
                </span>
              </div>

              <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">
                Unite a la <br /> <span className="text-river-red">Familia Riverplatense</span>
              </h2>

              <p className="text-gray-300 text-lg mb-8">
                No importa que tan lejos estemos del Monumental, la pasión nos une. Súmate a nuestra filial para participar de futuros eventos, recibir noticias de River y más.
              </p>

              <ul className="space-y-4 mb-10">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="text-river-red w-6 h-6 shrink-0" />
                  <span>Encuentros para partidos especiales.</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="text-river-red w-6 h-6 shrink-0" />
                  <span>Eventos Sociales</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="text-river-red w-6 h-6 shrink-0" />
                  <span>Próximos eventos y encuentros de la filial</span>
                </li>
              </ul>

              <a
                href="https://chat.whatsapp.com/LGMvmF1bKjJ2PlZ1GqCfo0"
                target="_blank"
                rel="noreferrer"
                className="bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold py-4 px-6 rounded-xl text-center transition-all flex items-center justify-center gap-3 shadow-lg hover:-translate-y-1"
              >
                Unite al grupo de WhatsApp
              </a>
            </div>

            {/* Form Side — Suscripción */}
            <div id="suscribite" className="lg:w-7/12 p-10 lg:p-16">
              <div className="flex items-center gap-2 mb-2">
                <Bell className="w-6 h-6 text-river-red" />
                <span className="text-river-red text-xs font-bold uppercase tracking-wider">Newsletter River en Israel</span>
              </div>
              <h3 className="font-display text-3xl font-bold text-river-black mb-1">Recibí las noticias de River al instante</h3>
              <p className="text-gray-500 mb-6 text-sm">Dejá tus datos y te avisamos primero — partidos, fichajes, eventos de la filial y novedades de la Banda.</p>

              {suscripEstado === "ok" ? (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  className="bg-green-50 border border-green-200 text-green-800 p-8 rounded-2xl text-center"
                >
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h4 className="text-2xl font-bold mb-2">¡Estás suscripto!</h4>
                  <p>Te vamos a avisar cada vez que haya novedades de River. ¡Gracias por sumarte a la Banda!</p>
                </motion.div>
              ) : (
                <form onSubmit={handleS(onSubmitSuscrip)} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Nombre completo</label>
                    <Input {...regS("nombre")} placeholder="Tu nombre y apellido" className={errS.nombre ? "border-red-500" : ""} />
                    {errS.nombre && <span className="text-xs text-red-500">{errS.nombre.message}</span>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> Correo electrónico
                    </label>
                    <Input {...regS("email")} type="email" placeholder="tu@email.com" className={errS.email ? "border-red-500" : ""} />
                    {errS.email && <span className="text-xs text-red-500">{errS.email.message}</span>}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" /> Celular <span className="text-gray-400 font-normal text-xs">(WhatsApp)</span>
                      </label>
                      <Input {...regS("telefono")} placeholder="+972 50 123 4567" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" /> Ciudad <span className="text-gray-400 font-normal text-xs">(opcional)</span>
                      </label>
                      <Input {...regS("ciudad")} placeholder="Tu ciudad" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">¿Cómo querés recibir las noticias?</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "email", label: "Email", icon: Mail },
                        { id: "whatsapp", label: "WhatsApp", icon: Phone },
                        { id: "telegram", label: "Telegram", icon: Send },
                      ].map(({ id, label, icon: Icon }) => {
                        const active = canales.includes(id);
                        return (
                          <button key={id} type="button" onClick={() => toggleCanal(id)}
                            className={cn(
                              "flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-xs font-bold transition-all",
                              active
                                ? "bg-river-red/10 border-river-red text-river-red"
                                : "border-gray-200 text-gray-500 hover:border-gray-300"
                            )}
                          >
                            <Icon className="w-4 h-4" />
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {suscripEstado === "error" && (
                    <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {suscripError}
                    </div>
                  )}

                  <Button type="submit" className="w-full h-12 text-base bg-river-red hover:bg-river-red-hover flex items-center gap-2" disabled={suscripEstado === "enviando"}>
                    {suscripEstado === "enviando" ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Suscribiéndote...</>
                    ) : (
                      <><Bell className="w-4 h-4" /> Suscribirme a las noticias</>
                    )}
                  </Button>

                  <p className="text-xs text-gray-400 text-center">
                    ¿Querés escribir notas en River Israel? <Link href="/postula" className="text-river-red font-semibold hover:underline">Postulate acá</Link>
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ================= FIXTURE SECTION ================= */}
      <section id="fixture" className="py-16 bg-river-black text-white relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[200px] bg-river-red/15 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-8">
            <span className="bg-river-red/20 px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wide uppercase text-river-red border border-river-red/30 inline-block mb-3">
              <Trophy className="w-3 h-3 inline mr-1 -mt-0.5" /> Calendario River
            </span>
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-2">
              <span className="text-river-red">Fixture</span> y Resultados
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto text-sm">Los próximos partidos y los últimos resultados del Millonario.</p>
          </div>

          {!matches && (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-2 border-river-red border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {matches && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(() => {
                const proximos = matches.filter(m => m.status === 'UPCOMING').slice(0, 3);
                const jugados = matches.filter(m => m.status === 'FINISHED' || m.status === 'LIVE').slice(0, 3);
                return [...jugados, ...proximos];
              })().map((match) => {
                const [golesRiver, golesRival] = match.isRiverHome
                  ? [match.homeScore, match.awayScore]
                  : [match.awayScore, match.homeScore];
                const ganamos = match.status === 'FINISHED' && golesRiver !== null && golesRival !== null && golesRiver > golesRival;
                const perdimos = match.status === 'FINISHED' && golesRiver !== null && golesRival !== null && golesRiver < golesRival;
                return (
                  <div key={match.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/[0.08] hover:border-river-red/30 transition-all">
                    <div className="flex justify-between items-center text-[10px] text-gray-400 mb-2">
                      <span className="font-semibold text-gray-300 truncate max-w-[140px]">{match.competition}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {match.status === 'LIVE' && (
                          <span className="flex items-center gap-0.5 bg-green-500 text-white px-1.5 py-0.5 rounded text-[9px] font-bold animate-pulse">
                            🔴 EN VIVO
                          </span>
                        )}
                        {match.status === 'FINISHED' && (
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-bold",
                            ganamos ? "bg-green-600 text-white" : perdimos ? "bg-red-700 text-white" : "bg-gray-600 text-white"
                          )}>
                            {ganamos ? "✓ Ganamos" : perdimos ? "✗ Perdimos" : "= Empate"}
                          </span>
                        )}
                        <span>{match.date}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className={cn("font-bold text-sm truncate leading-tight", match.isRiverHome ? "text-white" : "text-gray-400")}>
                          {match.homeTeam}
                        </div>
                        {(match.status === 'FINISHED' || match.status === 'LIVE') && (
                          <div className={cn("font-display text-2xl font-bold tabular-nums leading-none mt-1", match.isRiverHome ? "text-white" : "text-gray-400")}>
                            {match.homeScore ?? 0}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-gray-500 text-xs font-bold">
                        {match.status === 'FINISHED' || match.status === 'LIVE' ? '—' : 'vs'}
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        <div className={cn("font-bold text-sm truncate leading-tight", !match.isRiverHome ? "text-white" : "text-gray-400")}>
                          {match.awayTeam}
                        </div>
                        {(match.status === 'FINISHED' || match.status === 'LIVE') && (
                          <div className={cn("font-display text-2xl font-bold tabular-nums leading-none mt-1", !match.isRiverHome ? "text-white" : "text-gray-400")}>
                            {match.awayScore ?? 0}
                          </div>
                        )}
                      </div>
                    </div>
                    {match.status === 'UPCOMING' && match.horaIsrael && (
                      <p className="text-[11px] text-river-red font-semibold mt-2 text-center">
                        ⏰ {match.horaIsrael}
                      </p>
                    )}
                    {match.estadio && (
                      <p className="text-[10px] text-gray-500 mt-1 text-center">
                        🏟 {match.estadio}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-center mt-8">
            <Link
              href="/fixture"
              className="inline-flex items-center gap-2 bg-river-red hover:bg-river-red-hover text-white font-bold py-3 px-8 rounded-xl transition-all hover:-translate-y-0.5 shadow-lg"
            >
              Fixture completo <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ================= HISTORIA SECTION ================= */}
      <section id="historia" className="py-16 bg-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[500px] bg-diagonal-red opacity-5 -skew-y-3 origin-top-left -z-10"></div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-river-black mb-3">El Más <span className="text-river-red">Grande</span></h2>
            <p className="text-gray-600">Un repaso por los momentos que forjaron nuestra gloriosa historia.</p>
          </div>

          {/* Carousel deslizable — 3 tarjetas visibles */}
          <div className="overflow-x-auto snap-x snap-mandatory -mx-2 px-2" style={{ scrollbarWidth: "none" }}>
            <div className="flex gap-4" style={{ width: "max-content" }}>
              {timeline?.map((item, index) => (
                <motion.div
                  key={item.year}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.06 }}
                  className="snap-start w-[300px] sm:w-[320px] flex-none"
                >
                  <div className="h-full bg-gray-50 p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-river-red/20 transition-all flex flex-col">
                    <span className="font-display text-4xl font-bold text-river-red/20 block mb-1">{item.year}</span>
                    <h3 className="text-base font-bold text-river-black mb-2 leading-snug">{item.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed line-clamp-3 flex-1">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="text-center mt-10">
            <Link
              href="/historia"
              className="inline-flex items-center gap-2 border-2 border-river-red text-river-red hover:bg-river-red hover:text-white font-bold py-3 px-8 rounded-xl transition-all"
            >
              Historia completa <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
      {/* ================= GALERIA SECTION ================= */}
      <section id="galeria" className="py-24 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-river-red font-bold text-xs uppercase tracking-[0.3em] mb-3">Filial Ramat Gan · Israel</span>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">La Pasión <span className="text-river-red">en Imágenes</span></h2>
            <p className="text-gray-400 max-w-lg mx-auto">Hacé clic en cualquier foto para verla completa y descargarla.</p>
          </div>

          {/* ── Carrusel 3×4 ── */}
          <div className="relative">

            {/* Flecha izquierda */}
            {totalPaginas > 1 && (
              <button
                onClick={() => setPaginaGaleria(p => Math.max(0, p - 1))}
                disabled={paginaGaleria === 0}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-5 z-10 bg-white/10 hover:bg-river-red disabled:opacity-20 disabled:cursor-not-allowed text-white rounded-full p-2 transition-all shadow-lg"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Grid animado */}
            <div
              className="overflow-hidden"
              onMouseDown={e => { dragStartX.current = e.clientX; }}
              onMouseUp={e => {
                if (dragStartX.current === null) return;
                const diff = dragStartX.current - e.clientX;
                if (diff > 50) setPaginaGaleria(p => Math.min(totalPaginas - 1, p + 1));
                else if (diff < -50) setPaginaGaleria(p => Math.max(0, p - 1));
                dragStartX.current = null;
              }}
              onTouchStart={e => { dragStartX.current = e.touches[0].clientX; }}
              onTouchEnd={e => {
                if (dragStartX.current === null) return;
                const diff = dragStartX.current - e.changedTouches[0].clientX;
                if (diff > 50) setPaginaGaleria(p => Math.min(totalPaginas - 1, p + 1));
                else if (diff < -50) setPaginaGaleria(p => Math.max(0, p - 1));
                dragStartX.current = null;
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={paginaGaleria}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="grid grid-cols-4 gap-3"
                >
                  {galeriaFotos.length === 0
                    ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
                        <div key={i} className="aspect-[4/3] bg-white/5 rounded-xl animate-pulse" />
                      ))
                    : (() => {
                        const pageFotos = galeriaFotos.slice(paginaGaleria * PAGE_SIZE, (paginaGaleria + 1) * PAGE_SIZE);
                        const celdas = [...pageFotos, ...Array.from({ length: PAGE_SIZE - pageFotos.length })];
                        return celdas.map((foto, idx) => {
                          const globalIdx = paginaGaleria * PAGE_SIZE + idx;
                          if (!foto) return <div key={idx} className="aspect-[4/3] rounded-xl bg-white/3" />;
                          const f = foto as GaleriaFoto;
                          return (
                            <div
                              key={f.id}
                              className="aspect-[4/3] overflow-hidden rounded-xl cursor-pointer relative group"
                              onClick={() => abrirLightbox(globalIdx)}
                            >
                              <img
                                src={resolverUrl(f.url)}
                                alt={f.caption || `Foto ${globalIdx + 1}`}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300 flex items-center justify-center">
                                <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 drop-shadow-lg" />
                              </div>
                              {f.caption && (
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                                  <p className="text-white text-xs font-medium truncate">{f.caption}</p>
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()
                  }
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Flecha derecha */}
            {totalPaginas > 1 && (
              <button
                onClick={() => setPaginaGaleria(p => Math.min(totalPaginas - 1, p + 1))}
                disabled={paginaGaleria === totalPaginas - 1}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-5 z-10 bg-white/10 hover:bg-river-red disabled:opacity-20 disabled:cursor-not-allowed text-white rounded-full p-2 transition-all shadow-lg"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            {/* Indicadores de página */}
            {totalPaginas > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                {Array.from({ length: totalPaginas }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPaginaGaleria(i)}
                    className={`w-2 h-2 rounded-full transition-all ${i === paginaGaleria ? "bg-river-red w-6" : "bg-white/30 hover:bg-white/50"}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ================= VIDEOS SECTION ================= */}
      <section id="videos" className="py-10 bg-river-black text-white relative">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-3xl md:text-4xl font-display font-bold">Videos <span className="text-river-red">& Goles</span></h2>
              <p className="text-gray-400 mt-1 text-sm">Tocá un video para reproducirlo.</p>
            </div>
          </div>

          {/* Columna scrollable de videos */}
          {videos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-600">
              <Play className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Los videos se cargan desde el Redactor.</p>
            </div>
          )}
          <div className="flex flex-col gap-3 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin scrollbar-track-white/5 scrollbar-thumb-white/20">
            {videos.map((vid, i) => {
              const src = vid.url.startsWith("/objects/")
                ? `/api/storage${vid.url}`
                : `${import.meta.env.BASE_URL}${vid.url.replace(/^\//, "")}`;
              return (
                <button
                  key={vid.id}
                  onClick={() => setVideoAbierto(vid)}
                  className="w-full flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-river-red/50 rounded-2xl p-3 transition-all text-left group"
                >
                  {/* Miniatura */}
                  <div className="relative w-36 shrink-0 aspect-video rounded-xl overflow-hidden bg-black">
                    {vid.thumbnail ? (
                      <img
                        src={vid.thumbnail.startsWith("/objects/") ? `/api/storage${vid.thumbnail}` : `${import.meta.env.BASE_URL}${vid.thumbnail.replace(/^\//, "")}`}
                        alt={vid.titulo}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        src={src}
                        preload="metadata"
                        className="w-full h-full object-cover"
                        muted
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-river-red flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 text-white" fill="currentColor" />
                      </div>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-white group-hover:text-river-red transition-colors truncate">
                      {vid.titulo || `Video ${i + 1}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">Tap para reproducir</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-river-red shrink-0 transition-colors" />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= LIGHTBOX ================= */}
      <AnimatePresence>
        {lightboxIdx !== null && galeriaFotos[lightboxIdx] && (
          <motion.div
            key="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center"
            onClick={cerrarLightbox}
          >
            {/* Botón cerrar */}
            <button
              onClick={cerrarLightbox}
              className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors z-10"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Contador */}
            <span className="absolute top-5 left-1/2 -translate-x-1/2 text-white/60 text-sm font-medium">
              {lightboxIdx + 1} / {galeriaFotos.length}
            </span>

            {/* Botones nav */}
            <button
              onClick={e => { e.stopPropagation(); irAnterior(); }}
              className="absolute left-3 md:left-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-colors z-10"
            >
              <ChevronLeft className="w-7 h-7" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); irSiguiente(); }}
              className="absolute right-3 md:right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-colors z-10"
            >
              <ChevronRight className="w-7 h-7" />
            </button>

            {/* Imagen */}
            <motion.div
              key={lightboxIdx}
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="relative max-w-5xl max-h-[85vh] mx-16 flex flex-col items-center gap-3"
              onClick={e => e.stopPropagation()}
            >
              <img
                src={resolverUrl(galeriaFotos[lightboxIdx].url)}
                alt={galeriaFotos[lightboxIdx].caption}
                className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl"
              />
              <div className="flex items-center gap-4">
                {galeriaFotos[lightboxIdx].caption && (
                  <p className="text-white/80 text-sm">{galeriaFotos[lightboxIdx].caption}</p>
                )}
                <a
                  href={resolverUrl(galeriaFotos[lightboxIdx].url)}
                  download={`river-israel-${lightboxIdx + 1}.jpg`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 bg-river-red hover:bg-river-red/80 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LIGHTBOX DE VIDEO ─────────────────────────────────────────── */}
      <AnimatePresence>
        {videoAbierto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={() => setVideoAbierto(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-4xl"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setVideoAbierto(null)}
                className="absolute -top-10 right-0 flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors"
              >
                <X className="w-5 h-5" /> Cerrar
              </button>
              <div className="rounded-2xl overflow-hidden shadow-2xl bg-black aspect-video">
                <video
                  key={videoAbierto.id}
                  src={videoAbierto.url.startsWith("/objects/")
                    ? `/api/storage${videoAbierto.url}`
                    : `${import.meta.env.BASE_URL}${videoAbierto.url.replace(/^\//, "")}`}
                  poster={videoAbierto.thumbnail
                    ? (videoAbierto.thumbnail.startsWith("/objects/")
                      ? `/api/storage${videoAbierto.thumbnail}`
                      : `${import.meta.env.BASE_URL}${videoAbierto.thumbnail.replace(/^\//, "")}`)
                    : undefined}
                  controls
                  autoPlay
                  className="w-full h-full object-contain bg-black"
                  title={videoAbierto.titulo}
                />
              </div>
              {videoAbierto.titulo && (
                <p className="text-white font-bold text-lg mt-3 text-center">{videoAbierto.titulo}</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>

      {mostrarCredencial && (
        <CredencialGenerador onClose={() => setMostrarCredencial(false)} />
      )}
    </>
  );
}
