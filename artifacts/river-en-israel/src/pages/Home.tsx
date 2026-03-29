import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Calendar, Trophy, ChevronRight, CheckCircle2, ChevronDown, Mic, Video, Heart, Send, AlertCircle, Paperclip, X, ChevronLeft, Download, ZoomIn } from "lucide-react";
import { useNews, useMatches, useHistoryTimeline } from "@/hooks/use-river-data";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const postulSchema = z.object({
  nombre: z.string().min(2, "Ingresá tu nombre"),
  ciudad: z.string().min(2, "Ingresá tu ciudad"),
  tipo: z.enum(["Periodista", "Creador", "Fanático"], { required_error: "Elegí un perfil" }),
  texto: z.string().optional(),
  link: z.string().url("URL inválida").or(z.literal("")).optional(),
});
type PostulValues = z.infer<typeof postulSchema>;

const TIPOS_PERFIL = [
  { value: "Periodista" as const, icon: Mic, label: "Periodista" },
  { value: "Creador" as const, icon: Video, label: "Creador" },
  { value: "Fanático" as const, icon: Heart, label: "Fanático" },
];

export default function Home() {
  const [mostrarCredencial, setMostrarCredencial] = useState(false);
  const [postulEstado, setPostulEstado] = useState<"idle" | "enviando" | "ok" | "error">("idle");
  const [postulError, setPostulError] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);

  // Videos
  const [videos, setVideos] = useState<VideoGaleria[]>([]);
  const [videoAbierto, setVideoAbierto] = useState<VideoGaleria | null>(null);
  useEffect(() => {
    fetch("/api/videos", { cache: "no-store" })
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
    fetch("/api/galeria", { cache: "no-store" })
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

  const { data: news } = useNews();
  const { data: matches } = useMatches();
  const { data: timeline } = useHistoryTimeline();

  const { register: regP, handleSubmit: handleP, setValue: setValP, watch: watchP, formState: { errors: errP } } = useForm<PostulValues>({
    resolver: zodResolver(postulSchema),
  });
  const tipoSel = watchP("tipo");

  async function onSubmitPostul(data: PostulValues) {
    const textoValido = data.texto && data.texto.trim().length >= 50;
    if (!textoValido && !archivo) {
      setPostulError("Escribí tu nota (mínimo 50 caracteres) o adjuntá un archivo PDF/Word");
      setPostulEstado("error");
      return;
    }
    setPostulEstado("enviando");
    setPostulError("");
    try {
      const fd = new FormData();
      fd.append("nombre", data.nombre);
      fd.append("ciudad", data.ciudad);
      fd.append("tipo", data.tipo);
      if (data.texto?.trim()) fd.append("texto", data.texto.trim());
      if (data.link) fd.append("link", data.link);
      if (archivo) fd.append("archivo", archivo);

      const res = await fetch("/api/postular-redactor", { method: "POST", body: fd });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) { setPostulError(json.error ?? "Error al enviar"); setPostulEstado("error"); }
      else setPostulEstado("ok");
    } catch { setPostulError("Error de conexión"); setPostulEstado("error"); }
  }

  const fadeIn = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
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
            <p className="text-sm sm:text-base md:text-lg text-gray-100 mb-4 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] font-medium leading-snug">
              La Banda del Millonario latiendo fuerte desde Tierra Santa.<br />
              La misma pasión a miles de kilómetros.
            </p>
            <div className="flex flex-row flex-wrap gap-2">
              <a
                href="https://chat.whatsapp.com/CVctijXuwxmEJMpU4jmFMv?mode=gi_t"
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
                <a href="#escribi" className="whitespace-nowrap px-4 py-2 bg-white text-river-red font-bold rounded-full text-xs uppercase tracking-wide hover:bg-gray-100 transition-all">
                  Escribí en River Israel
                </a>
              </div>
            </div>
          </motion.div>

          {/* Escudo — derecha */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="relative flex-shrink-0 self-center"
          >
            <div className="absolute inset-0 bg-river-red/20 blur-3xl rounded-full scale-110" />
            <img
              src={`${import.meta.env.BASE_URL}images/escudo-carp.png?v=4`}
              alt="Escudo Club Atlético River Plate"
              className="relative z-10 w-28 h-28 sm:w-44 sm:h-44 md:w-56 md:h-56 object-contain"
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
                <Button variant="outline" className="rounded-full border-river-red text-river-red hover:bg-river-red hover:text-white mt-4">
                  Ver todas las noticias
                </Button>
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
                        <div className="absolute top-2 left-2 z-10">
                          <span className="bg-river-red text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow">
                            {item.category}
                          </span>
                        </div>
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
                        <span className={cn("flex-1 font-bold text-xs truncate", match.isRiverHome ? "text-white" : "text-gray-400")}>
                          {match.homeTeam}
                        </span>
                        <div className="font-display text-sm bg-black/40 px-2 py-0.5 rounded tabular-nums flex-shrink-0">
                          {match.status === 'FINISHED' || match.status === 'LIVE'
                            ? <span>{match.homeScore} <span className="text-river-red/70">-</span> {match.awayScore}</span>
                            : <span className="text-gray-400 text-xs">vs</span>
                          }
                        </div>
                        <span className={cn("flex-1 font-bold text-xs text-right truncate", !match.isRiverHome ? "text-white" : "text-gray-400")}>
                          {match.awayTeam}
                        </span>
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

      {/* ================= VIDEOS SECTION ================= */}
      {videos.length > 0 && (
      <section id="videos" className="py-10 bg-river-black text-white relative">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-3xl md:text-4xl font-display font-bold">Videos & <span className="text-river-red">Goles</span></h2>
              <p className="text-gray-400 mt-1 text-sm">Tocá un video para reproducirlo.</p>
            </div>
          </div>

          {/* Columna scrollable de videos */}
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
      )}

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
                <span className="bg-white/10 px-4 py-1.5 rounded-full text-sm font-semibold tracking-wider uppercase text-river-red border border-river-red/30">
                  Sede Oficial en Israel
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
                  <span>Encuentros para partidos especiales</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="text-river-red w-6 h-6 shrink-0" />
                  <span>Asados y eventos para conocernos</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="text-river-red w-6 h-6 shrink-0" />
                  <span>Vivir la vida roja y blanca</span>
                </li>
              </ul>

              <a
                href="https://chat.whatsapp.com/CVctijXuwxmEJMpU4jmFMv?mode=gi_t"
                target="_blank"
                rel="noreferrer"
                className="bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold py-4 px-6 rounded-xl text-center transition-all flex items-center justify-center gap-3 shadow-lg hover:-translate-y-1"
              >
                Unite al Grupo de WhatsApp
              </a>
            </div>

            {/* Form Side */}
            <div id="escribi" className="lg:w-7/12 p-10 lg:p-16">

              {/* Formulario: Escribí en el sitio */}
              <>
                  <h3 className="font-display text-3xl font-bold text-river-black mb-1">¡Escribí en River Israel!</h3>
                  <p className="text-gray-500 mb-6 text-sm">Periodista, creador o fanático — tu voz merece llegar a toda la comunidad.</p>

                  {postulEstado === "ok" ? (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                      className="bg-green-50 border border-green-200 text-green-800 p-8 rounded-2xl text-center"
                    >
                      <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                      <h4 className="text-2xl font-bold mb-2">¡Postulación enviada!</h4>
                      <p>La revisamos y te contactamos. ¡Gracias por querer ser parte!</p>
                    </motion.div>
                  ) : (
                    <form onSubmit={handleP(onSubmitPostul)} className="space-y-5">
                      {/* Tipo de perfil */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Soy...</label>
                        <div className="flex gap-2">
                          {TIPOS_PERFIL.map(({ value, icon: Icon, label }) => (
                            <button key={value} type="button"
                              onClick={() => setValP("tipo", value, { shouldValidate: true })}
                              className={cn(
                                "flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-xs font-bold transition-all",
                                tipoSel === value
                                  ? "bg-river-red/10 border-river-red text-river-red"
                                  : "border-gray-200 text-gray-500 hover:border-gray-300"
                              )}
                            >
                              <Icon className="w-4 h-4" />
                              {label}
                            </button>
                          ))}
                        </div>
                        {errP.tipo && <span className="text-xs text-red-500">{errP.tipo.message}</span>}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-gray-700">Nombre</label>
                          <Input {...regP("nombre")} placeholder="Tu nombre" className={errP.nombre ? "border-red-500" : ""} />
                          {errP.nombre && <span className="text-xs text-red-500">{errP.nombre.message}</span>}
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-gray-700">Ciudad</label>
                          <Input {...regP("ciudad")} placeholder="Tu ciudad" className={errP.ciudad ? "border-red-500" : ""} />
                          {errP.ciudad && <span className="text-xs text-red-500">{errP.ciudad.message}</span>}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700">Tu nota o propuesta</label>
                        <p className="text-xs text-gray-400">Solo corregimos ortografía, nunca cambiamos tu voz.</p>
                        <Textarea {...regP("texto")} placeholder="Escribí tu análisis, crónica o lo que quieras compartir..." rows={5} className={cn("text-sm resize-none", errP.texto ? "border-red-500" : "")} />
                      </div>

                      {/* Separador O */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-xs text-gray-400 font-semibold">O adjuntá un archivo</span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>

                      {/* Upload de archivo */}
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700">
                          Adjuntar nota <span className="text-gray-400 font-normal">(PDF o Word — opcional)</span>
                        </label>
                        {archivo ? (
                          <div className="flex items-center gap-2 bg-river-red/5 border border-river-red/20 rounded-lg px-3 py-2.5">
                            <Paperclip className="w-4 h-4 text-river-red shrink-0" />
                            <span className="text-sm text-river-black font-medium flex-1 truncate">{archivo.name}</span>
                            <button type="button" onClick={() => setArchivo(null)} className="text-gray-400 hover:text-gray-600">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex items-center gap-2 border-2 border-dashed border-gray-200 rounded-lg px-4 py-3 cursor-pointer hover:border-river-red/40 hover:bg-river-red/5 transition-colors">
                            <Paperclip className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-400">Seleccionar PDF o Word (.docx)</span>
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                              className="hidden"
                              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                            />
                          </label>
                        )}
                        <p className="text-xs text-gray-400">Máximo 10 MB. La IA extrae el texto y corrige solo la ortografía.</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700">
                          Link a tu canal / redes <span className="text-gray-400 font-normal">(opcional)</span>
                        </label>
                        <Input {...regP("link")} placeholder="https://youtube.com/@tucanal" className={errP.link ? "border-red-500" : ""} />
                        {errP.link && <span className="text-xs text-red-500">{errP.link.message}</span>}
                      </div>

                      {postulEstado === "error" && (
                        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          {postulError}
                        </div>
                      )}

                      <Button type="submit" className="w-full h-12 text-base bg-river-red hover:bg-river-red-hover flex items-center gap-2" disabled={postulEstado === "enviando"}>
                        {postulEstado === "enviando" ? (
                          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando...</>
                        ) : (
                          <><Send className="w-4 h-4" /> Enviar postulación</>
                        )}
                      </Button>
                    </form>
                  )}
                </>
            </div>
          </div>
        </div>
      </section>

      {/* ================= GALERIA SECTION ================= */}
      <section id="galeria" className="py-24 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-river-red font-bold text-xs uppercase tracking-[0.3em] mb-3">Filial Ramat Gan · Israel</span>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">La <span className="text-river-red">Pasión</span> en Imágenes</h2>
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

    </div>

      {mostrarCredencial && (
        <CredencialGenerador onClose={() => setMostrarCredencial(false)} />
      )}
    </>
  );
}
