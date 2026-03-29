import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Copy, Check, RotateCcw, Newspaper,
  Send, Search, ExternalLink, RefreshCw, ChevronDown, Globe, Pencil, X, ImageIcon, Upload, Trash2,
  BookOpen, CalendarDays, AlertTriangle, Wand2, Trophy, Inbox, Mic, Video, Heart, ChevronRight, CheckCircle2, XCircle, Eye, Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Tab = "redactor" | "publicaciones" | "historia" | "postulantes" | "galeria" | "videos" | "analytics";

interface AnalyticsData {
  noticias: { total: number; publicadas: number; pendientes: number; rechazadas: number };
  fuentes: { fuente: string; cantidad: number }[];
  galeria: { fotos: number };
  videos: { total: number };
  ultimas: { titulo: string; fuente: string; fecha: string }[];
  porMes: { mes: string; cantidad: number }[];
  fromCache: boolean;
  fetchedAt: number;
}

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

interface PostulacionDB {
  id: number;
  titulo: string;
  contenido: string;
  textoOriginal: string;
  fuente: string;
  publicada: boolean;
  pendiente: boolean;
  createdAt: string;
}

function parsearPostul(p: PostulacionDB) {
  const m = p.titulo.match(/✍️\s*(.+?)\s*\((.+?)\)/);
  const nombre = m?.[1]?.trim() ?? p.titulo.replace("✍️", "").trim();
  const ciudad = m?.[2]?.trim() ?? "";
  const partes = p.fuente.split(" · ");
  const tipo = partes[1] ?? "";
  const link = partes[2] ?? "";
  const tipoEmoji = tipo === "Periodista" ? <Mic className="w-3 h-3" /> : tipo === "Creador" ? <Video className="w-3 h-3" /> : <Heart className="w-3 h-3" />;
  return { nombre, ciudad, tipo, link, tipoEmoji };
}

interface HitoEdit {
  year: string;
  title: string;
  description: string;
  detail?: string;
  destacado?: boolean;
  imagenPortada?: string;
}
type Estado = "idle" | "procesando" | "listo" | "error";
type EstadoTelegram = "idle" | "enviando" | "enviado" | "error";
type EstadoPublicar = "idle" | "publicando" | "publicado" | "error";
type FuenteNoticias = "google" | "tyc" | "ole" | "infobae" | "clarin" | "lanacion" | "bolavip" | "as" | "superdeportivo";

interface NoticiaRaw {
  titulo: string;
  url: string;
  fuente: string;
}

interface NoticiaPublicada {
  id: number;
  titulo: string;
  contenido: string;
  fuente: string;
  imagenPortada: string;
  createdAt: string;
}

function resolverUrlGaleria(url: string) {
  if (url.startsWith("/objects/")) return `/api/storage/objects${url.slice(8)}`;
  if (url.startsWith("/images/")) return `${import.meta.env.BASE_URL}${url.slice(1)}`;
  return url;
}

function GaleriaTab() {
  const [fotos, setFotos] = useState<GaleriaFoto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [captionEdit, setCaptionEdit] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorSubida, setErrorSubida] = useState("");
  const [nuevoCaption, setNuevoCaption] = useState("");
  const [nuevoPreview, setNuevoPreview] = useState<string | null>(null);
  const [nuevoFile, setNuevoFile] = useState<File | null>(null);

  const cargar = async () => {
    setCargando(true);
    setError("");
    try {
      const res = await fetch("/api/galeria", { cache: "no-store" });
      const data = await res.json() as { fotos?: GaleriaFoto[] };
      setFotos(data.fotos ?? []);
    } catch {
      setError("No se pudo cargar la galería");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const guardarCaption = async (id: number) => {
    setGuardando(true);
    try {
      const res = await fetch(`/api/galeria/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: captionEdit }),
      });
      if (res.ok) {
        setFotos(prev => prev.map(f => f.id === id ? { ...f, caption: captionEdit } : f));
        setEditandoId(null);
      }
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id: number) => {
    setEliminandoId(id);
    try {
      await fetch(`/api/galeria/${id}`, { method: "DELETE" });
      setFotos(prev => prev.filter(f => f.id !== id));
    } finally {
      setEliminandoId(null);
      setConfirmEliminar(null);
    }
  };

  const subir = async () => {
    if (!nuevoFile) return;
    setSubiendoFoto(true);
    setErrorSubida("");
    try {
      const fd = new FormData();
      fd.append("foto", nuevoFile);
      fd.append("caption", nuevoCaption);
      const res = await fetch("/api/galeria", { method: "POST", body: fd });
      const data = await res.json() as { ok?: boolean; foto?: GaleriaFoto; error?: string };
      if (data.ok && data.foto) {
        setFotos(prev => [...prev, data.foto!]);
        setNuevoFile(null);
        setNuevoPreview(null);
        setNuevoCaption("");
      } else {
        setErrorSubida(data.error ?? "Error al subir");
      }
    } catch {
      setErrorSubida("Error al subir la foto");
    } finally {
      setSubiendoFoto(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-river-black flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-river-red" /> Galería de Fotos
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">{fotos.length} fotos · Editá el pie de foto, eliminá o agregá nuevas</p>
        </div>
        <button onClick={cargar} disabled={cargando}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-river-red transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${cargando ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Subir nueva foto */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
        <p className="font-semibold text-sm text-river-black mb-3 flex items-center gap-2">
          <Upload className="w-4 h-4 text-river-red" /> Agregar nueva foto
        </p>
        <div className="flex flex-col md:flex-row gap-4 items-start">
          <label className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:border-river-red rounded-xl w-32 h-32 shrink-0 overflow-hidden transition-colors bg-white">
            {nuevoPreview ? (
              <img src={nuevoPreview} className="w-full h-full object-cover" alt="Preview" />
            ) : (
              <>
                <Upload className="w-6 h-6 text-gray-400 mb-1" />
                <span className="text-xs text-gray-400">Elegir foto</span>
              </>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              setNuevoFile(file);
              const reader = new FileReader();
              reader.onload = ev => setNuevoPreview(ev.target?.result as string);
              reader.readAsDataURL(file);
            }} />
          </label>
          <div className="flex-1 space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Pie de foto (opcional)</label>
              <input
                value={nuevoCaption}
                onChange={e => setNuevoCaption(e.target.value)}
                placeholder="Ej: El Monumental en la noche mágica"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-river-red bg-white"
              />
            </div>
            {errorSubida && <p className="text-red-500 text-xs">{errorSubida}</p>}
            <Button
              onClick={subir}
              disabled={!nuevoFile || subiendoFoto}
              className="bg-river-red hover:bg-river-red/90 text-white text-sm font-bold px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {subiendoFoto ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
              {subiendoFoto ? "Subiendo..." : "Subir foto"}
            </Button>
          </div>
        </div>
      </div>

      {/* Grid de fotos */}
      {cargando ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : fotos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">Sin fotos aún</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {fotos.map(foto => (
            <div key={foto.id} className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              <div className="relative">
                <img
                  src={resolverUrlGaleria(foto.url)}
                  alt={foto.caption || "Foto"}
                  className="w-full aspect-square object-cover"
                  loading="lazy"
                />
                <button
                  onClick={() => { setConfirmEliminar(confirmEliminar === foto.id ? null : foto.id); }}
                  className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors"
                  title="Eliminar foto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {confirmEliminar === foto.id && (
                <div className="px-2 py-2 bg-red-50 border-t border-red-200 flex gap-2">
                  <button
                    onClick={() => eliminar(foto.id)}
                    disabled={eliminandoId === foto.id}
                    className="flex-1 text-xs bg-red-500 hover:bg-red-600 text-white font-bold py-1.5 rounded-lg transition-colors"
                  >
                    {eliminandoId === foto.id ? "Eliminando..." : "Confirmar eliminación"}
                  </button>
                  <button
                    onClick={() => setConfirmEliminar(null)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold transition-colors"
                  >
                    No
                  </button>
                </div>
              )}

              <div className="px-2 py-2">
                {editandoId === foto.id ? (
                  <div className="space-y-1.5">
                    <input
                      value={captionEdit}
                      onChange={e => setCaptionEdit(e.target.value)}
                      className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:border-river-red bg-white"
                      placeholder="Pie de foto..."
                      autoFocus
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => guardarCaption(foto.id)}
                        disabled={guardando}
                        className="flex-1 text-xs bg-green-500 hover:bg-green-600 text-white font-bold py-1.5 rounded-lg transition-colors"
                      >
                        {guardando ? "..." : "Guardar"}
                      </button>
                      <button
                        onClick={() => setEditandoId(null)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditandoId(foto.id); setCaptionEdit(foto.caption); }}
                    className="w-full text-left text-xs text-gray-500 hover:text-river-red flex items-center gap-1.5 py-0.5 transition-colors group"
                  >
                    <Pencil className="w-3 h-3 shrink-0 group-hover:text-river-red" />
                    <span className="truncate">{foto.caption || "Agregar pie de foto..."}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function resolverUrlVideo(url: string) {
  if (url.startsWith("/objects/")) return `/api/storage/objects${url.slice(8)}`;
  if (url.startsWith("/videos/")) return `${import.meta.env.BASE_URL}${url.slice(1)}`;
  return url;
}

function VideosTab() {
  const [videosList, setVideosList] = useState<VideoGaleria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null);
  const [subiendoVideo, setSubiendoVideo] = useState(false);
  const [errorSubida, setErrorSubida] = useState("");
  const [nuevoTitulo, setNuevoTitulo] = useState("");
  const [nuevoFile, setNuevoFile] = useState<File | null>(null);
  const [progreso, setProgreso] = useState(0);

  // Estado de edición por video
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editThumbFile, setEditThumbFile] = useState<File | null>(null);
  const [editThumbPreview, setEditThumbPreview] = useState<string | null>(null);
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [errorEdit, setErrorEdit] = useState("");

  const cargar = async () => {
    setCargando(true);
    setError("");
    try {
      const res = await fetch("/api/videos", { cache: "no-store" });
      const data = await res.json() as { videos?: VideoGaleria[] };
      setVideosList(data.videos ?? []);
    } catch {
      setError("No se pudo cargar los videos");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const abrirEdicion = (vid: VideoGaleria) => {
    setEditandoId(vid.id);
    setEditTitulo(vid.titulo);
    setEditThumbFile(null);
    setEditThumbPreview(vid.thumbnail ? resolverUrlVideo(vid.thumbnail) : null);
    setErrorEdit("");
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setEditThumbFile(null);
    setEditThumbPreview(null);
    setErrorEdit("");
  };

  const guardarEdicion = async (id: number) => {
    setGuardandoEdit(true);
    setErrorEdit("");
    try {
      const fd = new FormData();
      fd.append("titulo", editTitulo);
      if (editThumbFile) fd.append("thumbnail", editThumbFile);
      const res = await fetch(`/api/videos/${id}`, { method: "PUT", body: fd });
      const data = await res.json() as { ok?: boolean; video?: VideoGaleria; error?: string };
      if (data.ok && data.video) {
        setVideosList(prev => prev.map(v => v.id === id ? data.video! : v));
        cancelarEdicion();
      } else {
        setErrorEdit(data.error ?? "Error al guardar");
      }
    } catch {
      setErrorEdit("Error de conexión");
    } finally {
      setGuardandoEdit(false);
    }
  };

  const eliminar = async (id: number) => {
    setEliminandoId(id);
    try {
      await fetch(`/api/videos/${id}`, { method: "DELETE" });
      setVideosList(prev => prev.filter(v => v.id !== id));
    } finally {
      setEliminandoId(null);
      setConfirmEliminar(null);
    }
  };

  const subir = async () => {
    if (!nuevoFile) return;
    setSubiendoVideo(true);
    setErrorSubida("");
    setProgreso(0);
    try {
      const fd = new FormData();
      fd.append("video", nuevoFile);
      fd.append("titulo", nuevoTitulo);
      const res = await fetch("/api/videos", { method: "POST", body: fd });
      const data = await res.json() as { ok?: boolean; video?: VideoGaleria; error?: string };
      if (data.ok && data.video) {
        setVideosList(prev => [...prev, data.video!]);
        setNuevoFile(null);
        setNuevoTitulo("");
        setProgreso(100);
      } else {
        setErrorSubida(data.error ?? "Error al subir");
      }
    } catch {
      setErrorSubida("Error al subir el video");
    } finally {
      setSubiendoVideo(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-river-black flex items-center gap-2">
            <Video className="w-5 h-5 text-river-red" /> Videos de Galería
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">{videosList.length} videos · Subí, editá o eliminá videos de la galería</p>
        </div>
        <button onClick={cargar} disabled={cargando}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-river-red transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${cargando ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Subir nuevo video */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
        <p className="font-semibold text-sm text-river-black mb-3 flex items-center gap-2">
          <Upload className="w-4 h-4 text-river-red" /> Subir nuevo video
        </p>
        <div className="space-y-3">
          <label className="cursor-pointer flex items-center gap-3 border-2 border-dashed border-gray-300 hover:border-river-red rounded-xl px-4 py-4 transition-colors bg-white">
            <Video className="w-5 h-5 text-gray-400 shrink-0" />
            <div className="flex-1 min-w-0">
              {nuevoFile ? (
                <div>
                  <p className="text-sm font-semibold text-river-black truncate">{nuevoFile.name}</p>
                  <p className="text-xs text-gray-400">{(nuevoFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500 font-medium">Elegir video (MP4, MOV)</p>
                  <p className="text-xs text-gray-400">Máx. 200 MB</p>
                </div>
              )}
            </div>
            <input type="file" accept="video/*" className="hidden" onChange={e => {
              const file = e.target.files?.[0];
              if (file) { setNuevoFile(file); setProgreso(0); }
            }} />
          </label>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Título del video (opcional)</label>
            <input
              value={nuevoTitulo}
              onChange={e => setNuevoTitulo(e.target.value)}
              placeholder="Ej: Gol de Borja vs Boca"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-river-red bg-white"
            />
          </div>
          {errorSubida && <p className="text-red-500 text-xs">{errorSubida}</p>}
          {subiendoVideo && (
            <div className="bg-gray-200 rounded-full h-2">
              <div className="bg-river-red h-2 rounded-full transition-all" style={{ width: `${progreso || 50}%` }} />
            </div>
          )}
          <Button
            onClick={subir}
            disabled={!nuevoFile || subiendoVideo}
            className="bg-river-red hover:bg-river-red/90 text-white text-sm font-bold px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {subiendoVideo ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
            {subiendoVideo ? "Subiendo..." : "Subir video"}
          </Button>
        </div>
      </div>

      {/* Lista de videos */}
      {cargando ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : videosList.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Video className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">Sin videos aún</p>
          <p className="text-xs mt-1">Subí tu primer video arriba</p>
        </div>
      ) : (
        <div className="space-y-4">
          {videosList.map(vid => (
            <div key={vid.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

              {/* Vista normal */}
              {editandoId !== vid.id ? (
                <div className="flex gap-0">
                  {/* Portada / Preview */}
                  <div className="w-40 shrink-0 aspect-video bg-black relative overflow-hidden">
                    {vid.thumbnail ? (
                      <img
                        src={resolverUrlVideo(vid.thumbnail)}
                        alt={vid.titulo}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        src={resolverUrlVideo(vid.url)}
                        preload="metadata"
                        className="w-full h-full object-cover"
                        muted
                      />
                    )}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-river-red/90 flex items-center justify-center">
                        <Play className="w-4 h-4 text-white" fill="currentColor" />
                      </div>
                    </div>
                  </div>
                  {/* Info + acciones */}
                  <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                    <div>
                      <p className="font-bold text-river-black text-sm truncate">{vid.titulo || "Sin título"}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Video #{vid.orden}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <button
                        onClick={() => abrirEdicion(vid)}
                        className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 font-semibold transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </button>
                      {confirmEliminar === vid.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-600 font-semibold">¿Eliminar?</span>
                          <button
                            onClick={() => eliminar(vid.id)}
                            disabled={eliminandoId === vid.id}
                            className="text-xs bg-red-500 hover:bg-red-600 text-white font-bold px-2 py-1 rounded-lg transition-colors"
                          >
                            {eliminandoId === vid.id ? "..." : "Sí"}
                          </button>
                          <button
                            onClick={() => setConfirmEliminar(null)}
                            className="text-xs px-2 py-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmEliminar(vid.id)}
                          className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 font-semibold transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Panel de edición */
                <div className="p-4 space-y-4 bg-blue-50 border-t-2 border-blue-200">
                  <p className="text-sm font-bold text-blue-700 flex items-center gap-2">
                    <Pencil className="w-4 h-4" /> Editando: {vid.titulo || "Sin título"}
                  </p>

                  {/* Título */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Título</label>
                    <input
                      value={editTitulo}
                      onChange={e => setEditTitulo(e.target.value)}
                      placeholder="Ej: Gol de Borja vs Boca"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-river-red bg-white"
                      autoFocus
                    />
                  </div>

                  {/* Portada */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-2 block">
                      Portada del video <span className="text-gray-400 font-normal">(imagen que aparece antes de reproducir)</span>
                    </label>
                    <div className="flex gap-3 items-start">
                      {/* Preview actual */}
                      <div className="w-28 aspect-video rounded-lg overflow-hidden bg-gray-900 shrink-0 border border-gray-200">
                        {editThumbPreview ? (
                          <img src={editThumbPreview} alt="Portada" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-gray-500" />
                          </div>
                        )}
                      </div>
                      {/* Botón subir imagen */}
                      <label className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:border-river-red rounded-xl px-4 py-3 flex-1 transition-colors bg-white text-center">
                        <Upload className="w-5 h-5 text-gray-400 mb-1" />
                        <span className="text-xs text-gray-500 font-medium">
                          {editThumbFile ? editThumbFile.name : "Subir imagen de portada"}
                        </span>
                        <span className="text-xs text-gray-400">JPG, PNG · cualquier tamaño</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setEditThumbFile(file);
                            const reader = new FileReader();
                            reader.onload = ev => setEditThumbPreview(ev.target?.result as string);
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {errorEdit && <p className="text-red-500 text-xs">{errorEdit}</p>}

                  {/* Acciones */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      onClick={() => guardarEdicion(vid.id)}
                      disabled={guardandoEdit}
                      className="bg-river-red hover:bg-river-red/90 text-white text-sm font-bold px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
                    >
                      {guardandoEdit ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                      {guardandoEdit ? "Guardando..." : "Guardar cambios"}
                    </Button>
                    <button
                      onClick={cancelarEdicion}
                      className="text-sm px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Redactor() {
  const [tab, setTab] = useState<Tab>("redactor");
  const [textoOriginal, setTextoOriginal] = useState("");
  const [resultado, setResultado] = useState("");
  const [estado, setEstado] = useState<Estado>("idle");
  const [copiado, setCopiado] = useState(false);
  const [telegramEstado, setTelegramEstado] = useState<EstadoTelegram>("idle");
  const [telegramError, setTelegramError] = useState("");
  const [publicarEstado, setPublicarEstado] = useState<EstadoPublicar>("idle");
  const [publicarError, setPublicarError] = useState("");
  const [noticias, setNoticias] = useState<NoticiaRaw[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState("");
  const [fuente, setFuente] = useState<FuenteNoticias>("tyc");
  const resultadoRef = useRef<HTMLDivElement>(null);
  const [editando, setEditando] = useState(false);
  const [resultadoEditado, setResultadoEditado] = useState("");
  const [modoEdicionId, setModoEdicionId] = useState<number | null>(null);
  const [actualizandoEstado, setActualizandoEstado] = useState<"idle" | "guardando" | "guardado" | "error">("idle");
  const [imagenPortada, setImagenPortada] = useState<string>("");
  const [imagenPreview, setImagenPreview] = useState<string>("");
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [errorImagen, setErrorImagen] = useState("");
  const [ajustandoImagen, setAjustandoImagen] = useState(false);
  const [imagenAjustada, setImagenAjustada] = useState(false);

  // Mis publicaciones
  const [misPublicaciones, setMisPublicaciones] = useState<NoticiaPublicada[]>([]);
  const [cargandoPublicaciones, setCargandoPublicaciones] = useState(false);
  const [errorPublicaciones, setErrorPublicaciones] = useState("");
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);
  const [confirmEliminarId, setConfirmEliminarId] = useState<number | null>(null);

  // Historia
  const [historiaHitos, setHistoriaHitos] = useState<HitoEdit[]>([]);
  const [cargandoHistoria, setCargandoHistoria] = useState(false);
  const [editandoHitoIdx, setEditandoHitoIdx] = useState<number | null>(null);
  const [hitoEditado, setHitoEditado] = useState<HitoEdit | null>(null);
  const [guardandoHito, setGuardandoHito] = useState(false);
  const [guardadoHito, setGuardadoHito] = useState(false);
  const [errorHito, setErrorHito] = useState("");
  const [subiendoFotoHisto, setSubiendoFotoHisto] = useState(false);
  const [previewFotoHisto, setPreviewFotoHisto] = useState("");

  // Postulantes
  const [postulaciones, setPostulaciones] = useState<PostulacionDB[]>([]);
  const [cargandoPostul, setCargandoPostul] = useState(false);
  const [errorPostul, setErrorPostul] = useState("");
  const [postulSel, setPostulSel] = useState<PostulacionDB | null>(null);
  const [accionPostul, setAccionPostul] = useState<Record<number, "publicando" | "rechazando" | "ok" | "rechazado">>({});

  // Analytics
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [cargandoAnalytics, setCargandoAnalytics] = useState(false);
  const [errorAnalytics, setErrorAnalytics] = useState("");

  const cargarAnalytics = async (force = false) => {
    setCargandoAnalytics(true);
    setErrorAnalytics("");
    try {
      const res = await fetch(`/api/analytics${force ? "?force=1" : ""}`);
      const data = await res.json() as AnalyticsData;
      setAnalytics(data);
    } catch {
      setErrorAnalytics("Error al cargar las estadísticas");
    } finally {
      setCargandoAnalytics(false);
    }
  };

  const cargarPostulaciones = async () => {
    setCargandoPostul(true);
    setErrorPostul("");
    try {
      const res = await fetch("/api/postulaciones");
      const data = await res.json() as { postulaciones?: PostulacionDB[] };
      setPostulaciones(data.postulaciones ?? []);
      if (data.postulaciones?.[0] && !postulSel) setPostulSel(data.postulaciones[0]);
    } catch {
      setErrorPostul("Error al cargar postulaciones");
    } finally {
      setCargandoPostul(false);
    }
  };

  const publicarPostulacion = async (p: PostulacionDB) => {
    setAccionPostul(prev => ({ ...prev, [p.id]: "publicando" }));
    try {
      const res = await fetch(`/api/publicar/${p.id}`, { method: "POST" });
      if (res.ok) {
        setAccionPostul(prev => ({ ...prev, [p.id]: "ok" }));
        setPostulaciones(prev => prev.map(x => x.id === p.id ? { ...x, publicada: true, pendiente: false } : x));
        if (postulSel?.id === p.id) setPostulSel({ ...p, publicada: true, pendiente: false });
      }
    } catch { /* ignore */ }
  };

  const rechazarPostulacion = async (p: PostulacionDB) => {
    setAccionPostul(prev => ({ ...prev, [p.id]: "rechazando" }));
    try {
      const res = await fetch(`/api/postulaciones/${p.id}/rechazar`, { method: "POST" });
      if (res.ok) {
        setAccionPostul(prev => ({ ...prev, [p.id]: "rechazado" }));
        setPostulaciones(prev => prev.map(x => x.id === p.id ? { ...x, pendiente: false } : x));
        if (postulSel?.id === p.id) setPostulSel({ ...p, pendiente: false });
      }
    } catch { /* ignore */ }
  };

  const cargarPublicaciones = async () => {
    setCargandoPublicaciones(true);
    setErrorPublicaciones("");
    try {
      const res = await fetch("/api/noticias-publicadas");
      const data = await res.json() as { noticias?: NoticiaPublicada[] };
      setMisPublicaciones(data.noticias ?? []);
    } catch {
      setErrorPublicaciones("No se pudieron cargar las publicaciones");
    } finally {
      setCargandoPublicaciones(false);
    }
  };

  const eliminarPublicacion = async (id: number) => {
    setEliminandoId(id);
    try {
      await fetch(`/api/noticias-publicadas/${id}`, { method: "DELETE" });
      setMisPublicaciones((prev) => prev.filter((n) => n.id !== id));
      setConfirmEliminarId(null);
    } catch {
      // silencioso
    } finally {
      setEliminandoId(null);
    }
  };

  const editarPublicacion = (id: number) => {
    window.location.href = `/redactor?editar=${id}`;
  };

  const cargarHistoria = async () => {
    setCargandoHistoria(true);
    try {
      const res = await fetch("/api/historia");
      const data = await res.json() as { hitos?: HitoEdit[] };
      setHistoriaHitos(data.hitos ?? []);
    } catch { /* silent */ }
    finally { setCargandoHistoria(false); }
  };

  const abrirEditorHito = (idx: number) => {
    setEditandoHitoIdx(idx);
    setHitoEditado({ ...historiaHitos[idx] });
    setGuardadoHito(false);
    setErrorHito("");
    setPreviewFotoHisto(
      historiaHitos[idx].imagenPortada
        ? historiaHitos[idx].imagenPortada!.startsWith("/api/") || historiaHitos[idx].imagenPortada!.startsWith("http")
          ? historiaHitos[idx].imagenPortada!
          : `/api/storage${historiaHitos[idx].imagenPortada}`
        : ""
    );
  };

  const subirFotoHistoria = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setSubiendoFotoHisto(true);
    try {
      const urlRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name.replace(/\.[^.]+$/, ".jpg"), size: file.size, contentType: "image/jpeg" }),
      });
      const { uploadURL, objectPath } = await urlRes.json() as { uploadURL: string; objectPath: string };
      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": "image/jpeg" } });
      const previewUrl = URL.createObjectURL(file);
      setPreviewFotoHisto(previewUrl);
      setHitoEditado((prev) => prev ? { ...prev, imagenPortada: objectPath } : prev);
    } catch { /* silent */ }
    finally { setSubiendoFotoHisto(false); }
  };

  const guardarHito = async () => {
    if (editandoHitoIdx === null || !hitoEditado) return;
    setGuardandoHito(true);
    setErrorHito("");
    setGuardadoHito(false);
    try {
      const res = await fetch(`/api/historia/${editandoHitoIdx}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hitoEditado),
      });
      if (!res.ok) throw new Error("Error al guardar");
      const data = await res.json() as { hito: HitoEdit };
      setHistoriaHitos((prev) => prev.map((h, i) => i === editandoHitoIdx ? data.hito : h));
      setGuardadoHito(true);
      setTimeout(() => { setEditandoHitoIdx(null); setGuardadoHito(false); }, 1500);
    } catch {
      setErrorHito("No se pudo guardar. Intentá de nuevo.");
    } finally {
      setGuardandoHito(false);
    }
  };

  const procesarImagenCanvas = (file: File): Promise<{ blob: Blob; previewUrl: string }> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const srcUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(srcUrl);
        const TARGET_W = 1280;
        const TARGET_H = 720;
        const targetRatio = TARGET_W / TARGET_H;
        const srcRatio = img.width / img.height;
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (srcRatio > targetRatio) {
          sw = img.height * targetRatio;
          sx = (img.width - sw) / 2;
        } else {
          sh = img.width / targetRatio;
          sy = (img.height - sh) / 2;
        }
        const canvas = document.createElement("canvas");
        canvas.width = TARGET_W;
        canvas.height = TARGET_H;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas no soportado")); return; }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, TARGET_W, TARGET_H);
        const previewUrl = canvas.toDataURL("image/jpeg", 0.85);
        canvas.toBlob((blob) => {
          if (blob) resolve({ blob, previewUrl });
          else reject(new Error("Error al procesar la imagen"));
        }, "image/jpeg", 0.9);
      };
      img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
      img.src = srcUrl;
    });

  const subirImagen = async (file: File) => {
    if (!file.type.startsWith("image/")) { setErrorImagen("Solo se permiten imágenes"); return; }
    if (file.size > 15 * 1024 * 1024) { setErrorImagen("La imagen no puede superar 15MB"); return; }
    setSubiendoImagen(true);
    setErrorImagen("");
    try {
      const { blob, previewUrl } = await procesarImagenCanvas(file);
      setImagenPreview(previewUrl);
      const urlRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name.replace(/\.[^.]+$/, ".jpg"), size: blob.size, contentType: "image/jpeg" }),
      });
      if (!urlRes.ok) throw new Error("No se pudo obtener URL de subida");
      const { uploadURL, objectPath } = await urlRes.json() as { uploadURL: string; objectPath: string };
      const putRes = await fetch(uploadURL, { method: "PUT", body: blob, headers: { "Content-Type": "image/jpeg" } });
      if (!putRes.ok) throw new Error("Error al subir la imagen");
      setImagenPortada(objectPath);
    } catch (err) {
      setErrorImagen(err instanceof Error ? err.message : "Error al subir");
      setImagenPreview("");
    } finally {
      setSubiendoImagen(false);
    }
  };

  const ajustarImagenConIA = async () => {
    if (!imagenPortada && !imagenPreview) return;
    setAjustandoImagen(true);
    setImagenAjustada(false);
    setErrorImagen("");
    try {
      let blob: Blob;
      if (imagenPortada) {
        const res = await fetch(`/api/storage${imagenPortada}`);
        if (!res.ok) throw new Error("No se pudo cargar la imagen desde el servidor");
        blob = await res.blob();
      } else {
        const res = await fetch(imagenPreview);
        if (!res.ok) throw new Error("No se pudo cargar la imagen");
        blob = await res.blob();
      }
      const mimeType = blob.type.startsWith("image/") ? blob.type : "image/jpeg";
      const file = new File([blob], "portada.jpg", { type: mimeType });
      await subirImagen(file);
      setImagenAjustada(true);
      // Limpiar el mensaje de éxito después de 4 segundos
      setTimeout(() => setImagenAjustada(false), 4000);
    } catch (err) {
      setErrorImagen(err instanceof Error ? err.message : "Error al ajustar la imagen");
    } finally {
      setAjustandoImagen(false);
    }
  };

  const cargarParaEditar = async (id: number) => {
    try {
      const res = await fetch(`/api/noticia-pendiente/${id}`);
      const data = await res.json() as { noticia?: { id: number; titulo: string; contenido: string; tags: string; imagenPortada?: string } };
      if (data.noticia) {
        const n = data.noticia;
        const texto = `**Título:** ${n.titulo}\n\n**Contenido:**\n${n.contenido}\n\n**Tags:** ${n.tags}`;
        setResultado(texto);
        setEstado("listo");
        setModoEdicionId(n.id);
        setEditando(true);
        setResultadoEditado(texto);
        // Cargar imagen existente si la hay
        if (n.imagenPortada) {
          setImagenPortada(n.imagenPortada);
          setImagenPreview(`/api/storage${n.imagenPortada}`);
        }
      }
    } catch { /* silencioso */ }
  };

  const actualizarYPublicar = async () => {
    if (!modoEdicionId || !resultadoEditado.trim()) return;
    setActualizandoEstado("guardando");
    try {
      const res = await fetch(`/api/noticia-pendiente/${modoEdicionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textoResultado: resultadoEditado,
          ...(imagenPortada ? { imagenPortada } : {}),
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Error al guardar");
      setResultado(resultadoEditado);
      setEditando(false);
      setActualizandoEstado("guardado");
      setPublicarEstado("publicado");
    } catch {
      setActualizandoEstado("error");
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editarId = params.get("editar");
    if (editarId) {
      const id = parseInt(editarId);
      if (!isNaN(id)) cargarParaEditar(id);
    }
  }, []);

  const buscarNoticias = async () => {
    setBuscando(true);
    setErrorBusqueda("");
    setNoticias([]);
    try {
      const res = await fetch(`/api/noticias-river?fuente=${fuente}`);
      const data = await res.json() as { noticias?: NoticiaRaw[]; error?: string };
      if (!res.ok || !data.noticias) {
        setErrorBusqueda(data.error ?? "No se encontraron noticias");
      } else {
        setNoticias(data.noticias);
      }
    } catch {
      setErrorBusqueda("No se pudo conectar con el servidor");
    }
    setBuscando(false);
  };

  const seleccionarNoticia = (titulo: string) => {
    setTextoOriginal(titulo);
    setResultado("");
    setEstado("idle");
    setTelegramEstado("idle");
  };

  const procesarNoticia = async () => {
    if (!textoOriginal.trim() || textoOriginal.trim().length < 10) return;

    setEstado("procesando");
    setResultado("");
    setTelegramEstado("idle");

    try {
      const response = await fetch("/api/procesar-noticia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: textoOriginal }),
      });

      if (!response.ok || !response.body) throw new Error("Error en la respuesta del servidor");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6)) as { content?: string; done?: boolean; error?: string };
              if (data.content) {
                setResultado((prev) => prev + data.content);
                resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
              }
              if (data.done) setEstado("listo");
              if (data.error) setEstado("error");
            } catch { /* ignore incomplete chunks */ }
          }
        }
      }
    } catch {
      setEstado("error");
      setResultado("❌ Hubo un error procesando la noticia. Intentá de nuevo.");
    }
  };

  const copiar = async () => {
    await navigator.clipboard.writeText(resultado);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const reiniciar = () => {
    setTextoOriginal("");
    setResultado("");
    setEstado("idle");
    setTelegramEstado("idle");
    setTelegramError("");
    setPublicarEstado("idle");
    setPublicarError("");
    setImagenPortada("");
    setImagenPreview("");
    setErrorImagen("");
  };

  const publicarEnSitio = async () => {
    if (!resultado.trim()) return;
    setPublicarEstado("publicando");
    setPublicarError("");
    try {
      const noticiaSeleccionada = noticias.find((n) => n.titulo === textoOriginal);
      const res = await fetch("/api/publicar-noticia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textoResultado: resultado,
          textoOriginal,
          fuente: noticiaSeleccionada?.fuente ?? fuente,
          imagenPortada,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setPublicarEstado("error");
        setPublicarError(data.error ?? "Error desconocido");
      } else {
        setPublicarEstado("publicado");
      }
    } catch {
      setPublicarEstado("error");
      setPublicarError("No se pudo conectar al servidor");
    }
  };

  const enviarTelegram = async () => {
    if (!resultado.trim()) return;
    setTelegramEstado("enviando");
    setTelegramError("");
    try {
      const noticiaSeleccionada = noticias.find((n) => n.titulo === textoOriginal);
      const res = await fetch("/api/enviar-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: resultado,
          textoOriginal,
          fuente: noticiaSeleccionada?.fuente ?? fuente,
          imagenPortada,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setTelegramEstado("error");
        setTelegramError(data.error ?? "Error desconocido");
      } else {
        setTelegramEstado("enviado");
      }
    } catch {
      setTelegramEstado("error");
      setTelegramError("No se pudo conectar al servidor");
    }
  };

  const renderResultado = (texto: string) => {
    return texto.split("\n").map((line, i) => {
      if (line.startsWith("**Título:**")) {
        return (
          <h2 key={i} className="text-2xl md:text-3xl font-display font-bold text-river-black mb-4">
            {line.replace("**Título:**", "").trim()}
          </h2>
        );
      }
      if (line.startsWith("**Contenido:**")) {
        return <p key={i} className="text-xs font-bold text-river-red mb-2 uppercase tracking-widest">Nota para el sitio</p>;
      }
      if (line.startsWith("**Tags:**")) {
        return <p key={i} className="mt-4 text-river-red font-semibold text-sm">{line.replace("**Tags:**", "").trim()}</p>;
      }
      if (line.startsWith("•")) {
        return (
          <li key={i} className="flex items-start gap-2 text-gray-700 mb-1">
            <span className="text-river-red font-bold mt-0.5">•</span>
            <span>{line.slice(1).trim()}</span>
          </li>
        );
      }
      if (line.trim() === "") return <br key={i} />;
      return <p key={i} className="text-gray-700 mb-3 leading-relaxed">{line}</p>;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-river-red/10 text-river-red px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-4 h-4" />
            Cocina Privada — River en Israel
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-river-black mb-3">
            Redactor <span className="text-river-red">IA</span>
          </h1>
          <p className="text-gray-500 max-w-xl mx-auto">
            Elegí un medio (TyC, Olé, Infobae, Clarín, La Nación y más), la IA transforma la nota al estilo israelí, y aprobás o rechazás desde tu Telegram.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm gap-1">
            <button
              onClick={() => setTab("redactor")}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === "redactor"
                  ? "bg-river-red text-white shadow-sm"
                  : "text-gray-500 hover:text-river-red"
              }`}
            >
              <Sparkles className="w-4 h-4" /> Redactor IA
            </button>
            <button
              onClick={() => { setTab("publicaciones"); cargarPublicaciones(); }}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === "publicaciones"
                  ? "bg-river-red text-white shadow-sm"
                  : "text-gray-500 hover:text-river-red"
              }`}
            >
              <BookOpen className="w-4 h-4" /> Mis publicaciones
            </button>
            <button
              onClick={() => { setTab("historia"); cargarHistoria(); }}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === "historia"
                  ? "bg-river-red text-white shadow-sm"
                  : "text-gray-500 hover:text-river-red"
              }`}
            >
              <Trophy className="w-4 h-4" /> Historia
            </button>
            <button
              onClick={() => { setTab("analytics"); if (!analytics) cargarAnalytics(); }}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === "analytics"
                  ? "bg-river-red text-white shadow-sm"
                  : "text-gray-500 hover:text-river-red"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              Analytics
            </button>
            <button
              onClick={() => { setTab("postulantes"); cargarPostulaciones(); }}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all relative ${
                tab === "postulantes"
                  ? "bg-river-red text-white shadow-sm"
                  : "text-gray-500 hover:text-river-red"
              }`}
            >
              <Inbox className="w-4 h-4" /> Postulantes
              {postulaciones.filter(p => p.pendiente).length > 0 && tab !== "postulantes" && (
                <span className="absolute -top-1 -right-1 bg-river-red text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-white">
                  {postulaciones.filter(p => p.pendiente).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab("galeria")}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === "galeria"
                  ? "bg-river-red text-white shadow-sm"
                  : "text-gray-500 hover:text-river-red"
              }`}
            >
              <ImageIcon className="w-4 h-4" /> Fotos de Galería
            </button>
            <button
              onClick={() => setTab("videos")}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === "videos"
                  ? "bg-river-red text-white shadow-sm"
                  : "text-gray-500 hover:text-river-red"
              }`}
            >
              <Video className="w-4 h-4" /> Videos de Galería
            </button>
          </div>
        </div>

        {/* ── MIS PUBLICACIONES ─────────────────────────────────────────── */}
        {tab === "publicaciones" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-xl font-bold text-river-black">Noticias publicadas</h2>
              <button
                onClick={cargarPublicaciones}
                disabled={cargandoPublicaciones}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-river-red transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${cargandoPublicaciones ? "animate-spin" : ""}`} />
                Actualizar
              </button>
            </div>

            {errorPublicaciones && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {errorPublicaciones}
              </div>
            )}

            {cargandoPublicaciones && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 animate-pulse">
                    <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-1/4" />
                  </div>
                ))}
              </div>
            )}

            {!cargandoPublicaciones && misPublicaciones.length === 0 && !errorPublicaciones && (
              <div className="text-center py-16 text-gray-400">
                <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                <p className="font-medium">No hay publicaciones todavía</p>
                <p className="text-sm mt-1">Las noticias aprobadas aparecerán acá</p>
              </div>
            )}

            {!cargandoPublicaciones && misPublicaciones.map((n) => (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm"
              >
                <div className="flex gap-4 p-4">
                  {n.imagenPortada && (
                    <img
                      src={`/api/storage${n.imagenPortada}`}
                      alt=""
                      className="w-24 h-16 object-cover rounded-xl shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-river-black text-sm leading-snug line-clamp-2 mb-1">
                      {n.titulo}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />
                        {new Date(n.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      {n.fuente && <span className="bg-gray-100 px-2 py-0.5 rounded-full">{n.fuente}</span>}
                    </div>
                  </div>
                </div>

                {confirmEliminarId === n.id ? (
                  <div className="border-t border-gray-100 bg-red-50 px-4 py-3 flex items-center justify-between gap-3">
                    <p className="text-sm text-red-600 font-medium">¿Eliminar esta nota del sitio?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmEliminarId(null)}
                        className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-100"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => eliminarPublicacion(n.id)}
                        disabled={eliminandoId === n.id}
                        className="px-3 py-1.5 text-xs text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60"
                      >
                        {eliminandoId === n.id ? "Eliminando..." : "Sí, eliminar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-gray-100 px-4 py-2.5 flex gap-2">
                    <button
                      onClick={() => editarPublicacion(n.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:border-river-red hover:text-river-red transition-colors"
                    >
                      <Pencil className="w-3 h-3" /> Editar
                    </button>
                    <button
                      onClick={() => setConfirmEliminarId(n.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:border-red-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" /> Eliminar
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* ── HISTORIA ──────────────────────────────────────────────────── */}
        {tab === "historia" && (
          <div className="relative">

            {/* ─ Cabecera de sección ─ */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display text-xl font-bold text-river-black">Página Historia</h2>
                <p className="text-xs text-gray-400 mt-0.5">Vista previa real · hacé clic en ✏️ sobre cualquier hito para editar</p>
              </div>
              <button
                onClick={cargarHistoria}
                disabled={cargandoHistoria}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-river-red transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${cargandoHistoria ? "animate-spin" : ""}`} />
                Actualizar
              </button>
            </div>

            {/* ─ Skeleton ─ */}
            {cargandoHistoria && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 animate-pulse">
                    <div className="h-5 bg-gray-100 rounded w-1/5 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-3/4 mb-1.5" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                ))}
              </div>
            )}

            {/* ─ Palmarés (réplica visual) ─ */}
            {!cargandoHistoria && (
              <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 mb-5">
                <div className="bg-river-red text-white py-5 px-5">
                  <div className="grid grid-cols-4 md:grid-cols-7 gap-3 text-center">
                    {[
                      { n: "38", l: "Primera División" },
                      { n: "4",  l: "Copa Libertadores" },
                      { n: "1",  l: "Copa Intercontinental" },
                      { n: "1",  l: "Copa Sudamericana" },
                      { n: "3",  l: "Copa Argentina" },
                      { n: "3",  l: "Súper Copa" },
                      { n: "2",  l: "Trofeo Campeones" },
                    ].map(t => (
                      <div key={t.l} className="space-y-0.5">
                        <div className="text-2xl font-display font-bold">{t.n}</div>
                        <div className="text-[10px] text-white/70 uppercase tracking-wide leading-tight">{t.l}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Eras */}
                <div className="bg-gray-50 border-t border-gray-100 px-5 py-3 flex flex-wrap gap-2">
                  {[
                    { n: "Los Orígenes", y: "1901–1937", c: "bg-gray-100 text-gray-600" },
                    { n: "La Edad Dorada", y: "1938–1985", c: "bg-amber-50 text-amber-700" },
                    { n: "Campeones del Mundo", y: "1986–2013", c: "bg-red-50 text-red-700" },
                    { n: "Era Gallardo I", y: "2014–2022", c: "bg-river-red text-white" },
                    { n: "Era Demichelis", y: "2023–2024", c: "bg-river-red/80 text-white" },
                    { n: "Era Gallardo II", y: "2024–2026", c: "bg-river-red text-white" },
                    { n: "Era Coudet", y: "2026–Pres.", c: "bg-river-red/60 text-white" },
                  ].map(e => (
                    <span key={e.n} className={`text-xs font-bold px-3 py-1 rounded-full ${e.c}`}>
                      {e.n} · <span className="font-normal opacity-80">{e.y}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ─ Timeline réplica con botones de edición ─ */}
            {!cargandoHistoria && (
              <div className="relative border-l-4 border-river-red/20 ml-4 space-y-5 pl-8">
                {historiaHitos.map((hito, idx) => {
                  const imgSrc = hito.imagenPortada
                    ? (hito.imagenPortada.startsWith("/api/") || hito.imagenPortada.startsWith("http")
                      ? hito.imagenPortada
                      : `/api/storage${hito.imagenPortada}`)
                    : null;
                  return (
                    <div key={idx} className="relative group">
                      {/* Dot */}
                      <div className={`absolute top-4 left-[-43px] w-6 h-6 rounded-full border-4 border-white shadow-md z-10 ${hito.destacado ? "bg-river-red" : "bg-gray-400"}`} />

                      <div className={`rounded-2xl border overflow-hidden transition-shadow ${hito.destacado ? "border-river-red/20 shadow-md" : "border-gray-100 shadow-sm"}`}>
                        {imgSrc && (
                          <div className="h-36 overflow-hidden">
                            <img src={imgSrc} alt={hito.title} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className={`p-4 ${hito.destacado ? "bg-red-50/40" : "bg-gray-50"}`}>
                          <div className="flex items-start justify-between gap-3 mb-1">
                            <div className="flex-1 min-w-0">
                              <span className={`font-display text-2xl font-bold block leading-none mb-0.5 ${hito.destacado ? "text-river-red" : "text-river-red/30"}`}>{hito.year}</span>
                              <h3 className="text-base font-bold text-river-black flex items-center gap-1.5">
                                {hito.destacado && <Trophy className="w-3.5 h-3.5 text-river-red shrink-0" />}
                                {hito.title}
                              </h3>
                            </div>
                            {/* Botón editar — siempre visible para el redactor */}
                            <button
                              onClick={() => abrirEditorHito(idx)}
                              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-white border border-gray-200 rounded-lg text-gray-500 hover:border-river-red hover:text-river-red shadow-sm transition-colors"
                            >
                              <Pencil className="w-3 h-3" /> Editar
                            </button>
                          </div>
                          <p className="text-gray-600 text-sm">{hito.description}</p>
                          {hito.detail && (
                            <p className="text-gray-400 text-xs leading-relaxed border-t border-gray-200/60 pt-2 mt-2">{hito.detail}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ─ Panel lateral de edición (slide-over) ─ */}
            <AnimatePresence>
              {editandoHitoIdx !== null && hitoEditado && (
                <>
                  {/* Overlay */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setEditandoHitoIdx(null)}
                    className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
                  />
                  {/* Panel */}
                  <motion.div
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ type: "spring", damping: 28, stiffness: 300 }}
                    className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col"
                  >
                    {/* Cabecera panel */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Editando hito</p>
                        <p className="font-display text-2xl font-bold text-river-red">{historiaHitos[editandoHitoIdx]?.year}</p>
                      </div>
                      <button onClick={() => setEditandoHitoIdx(null)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
                    </div>

                    {/* Cuerpo scrollable */}
                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Título</label>
                        <input
                          value={hitoEditado.title}
                          onChange={(e) => setHitoEditado((p) => p ? { ...p, title: e.target.value } : p)}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-river-red/30 focus:border-river-red"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Descripción corta</label>
                        <Textarea
                          value={hitoEditado.description}
                          onChange={(e) => setHitoEditado((p) => p ? { ...p, description: e.target.value } : p)}
                          className="min-h-[90px] resize-none text-sm border-gray-200 focus-visible:ring-river-red/30"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          Detalle extendido <span className="font-normal text-gray-400">(aparece debajo)</span>
                        </label>
                        <Textarea
                          value={hitoEditado.detail ?? ""}
                          onChange={(e) => setHitoEditado((p) => p ? { ...p, detail: e.target.value } : p)}
                          className="min-h-[90px] resize-none text-sm border-gray-200 focus-visible:ring-river-red/30"
                          placeholder="Texto adicional..."
                        />
                      </div>

                      {/* Foto portada */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" /> Foto de portada
                        </label>
                        {previewFotoHisto ? (
                          <div className="relative rounded-xl overflow-hidden border border-gray-200">
                            <img src={previewFotoHisto} alt="portada" className="w-full h-32 object-cover" />
                            {subiendoFotoHisto && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full inline-block" />
                              </div>
                            )}
                            <label className="absolute bottom-2 left-2 cursor-pointer">
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) subirFotoHistoria(f); }} />
                              <span className="bg-white/90 hover:bg-white text-gray-700 text-xs font-semibold px-2 py-1 rounded-lg flex items-center gap-1">
                                <Upload className="w-3 h-3" /> Cambiar
                              </span>
                            </label>
                            <button
                              onClick={() => { setPreviewFotoHisto(""); setHitoEditado((p) => p ? { ...p, imagenPortada: "" } : p); }}
                              className="absolute bottom-2 right-2 bg-white/90 hover:bg-white text-gray-700 text-xs font-semibold px-2 py-1 rounded-lg flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> Quitar
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center gap-2 w-full h-20 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-river-red hover:bg-red-50/30 transition-colors group">
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) subirFotoHistoria(f); }} />
                            <Upload className="w-4 h-4 text-gray-300 group-hover:text-river-red" />
                            <span className="text-xs text-gray-400">Subir foto</span>
                          </label>
                        )}
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hitoEditado.destacado ?? false}
                          onChange={(e) => setHitoEditado((p) => p ? { ...p, destacado: e.target.checked } : p)}
                          className="w-4 h-4 accent-river-red"
                        />
                        <span className="text-xs font-semibold text-gray-600">Hito destacado (punto rojo + estrella)</span>
                      </label>

                      {errorHito && (
                        <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{errorHito}</p>
                      )}
                    </div>

                    {/* Footer panel */}
                    <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
                      <Button
                        onClick={guardarHito}
                        disabled={guardandoHito || guardadoHito}
                        className="flex-1 gap-2 bg-river-red hover:bg-river-red/90 text-white font-bold h-11 rounded-xl"
                      >
                        {guardandoHito ? (
                          <><span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full inline-block" /> Guardando...</>
                        ) : guardadoHito ? (
                          <><Check className="w-3.5 h-3.5" /> ¡Guardado!</>
                        ) : (
                          <><Globe className="w-3.5 h-3.5" /> Guardar</>
                        )}
                      </Button>
                      <Button variant="outline" onClick={() => setEditandoHitoIdx(null)} className="h-11 px-4 rounded-xl">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── REDACTOR IA ───────────────────────────────────────────────── */}
        {tab === "redactor" && <>

        {/* Flujo 3 pasos */}
        <div className="flex items-center justify-center gap-3 mb-10 text-xs font-bold uppercase tracking-wider text-gray-400">
          <span className="flex items-center gap-1.5 text-river-red"><span className="w-6 h-6 rounded-full bg-river-red text-white flex items-center justify-center text-xs">1</span> Buscar noticia</span>
          <span className="text-gray-200">──────</span>
          <span className="flex items-center gap-1.5"><span className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs">2</span> Transformar con IA</span>
          <span className="text-gray-200">──────</span>
          <span className="flex items-center gap-1.5"><span className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs">3</span> Aprobar / Publicar</span>
        </div>

        {/* PASO 1: Buscador de noticias */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="font-display text-lg font-bold text-river-black mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-river-red" />
            Paso 1 — Buscar última noticia
          </h2>

          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5"><Globe className="w-3 h-3" /> Elegí el medio</p>
            <div className="flex flex-wrap gap-2">
              {([
                { id: "google", label: "Google News (50+)" },
                { id: "tyc", label: "TyC Sports" },
                { id: "ole", label: "Olé" },
                { id: "infobae", label: "Infobae" },
                { id: "clarin", label: "Clarín" },
                { id: "lanacion", label: "La Nación" },
                { id: "bolavip", label: "Bolavip" },
                { id: "as", label: "AS Argentina" },
                { id: "superdeportivo", label: "SuperDeportivo" },
              ] as { id: FuenteNoticias; label: string }[]).map((f) => (
                <button
                  key={f.id}
                  onClick={() => { setFuente(f.id); setNoticias([]); setErrorBusqueda(""); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                    fuente === f.id
                      ? "bg-river-red text-white border-river-red"
                      : "bg-white text-gray-500 border-gray-200 hover:border-river-red hover:text-river-red"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 mb-4">

            <Button
              onClick={buscarNoticias}
              disabled={buscando}
              className="gap-2 bg-river-black hover:bg-river-black/80 text-white"
            >
              {buscando ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Buscando...</>
              ) : (
                <><Search className="w-4 h-4" /> Buscar ahora</>
              )}
            </Button>
          </div>

          {errorBusqueda && (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-3">
              ⚠️ {errorBusqueda}
            </p>
          )}

          {noticias.length > 0 && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                  <ChevronDown className="w-3 h-3" /> Hacé clic en una noticia para seleccionarla:
                </p>
                {noticias.map((n, i) => (
                  <button
                    key={i}
                    onClick={() => seleccionarNoticia(n.titulo)}
                    className={`w-full text-left flex items-start gap-3 rounded-xl border px-4 py-3 transition-all group
                      ${textoOriginal === n.titulo
                        ? "border-river-red bg-river-red/5 shadow-sm"
                        : "border-gray-200 hover:border-river-red/40 hover:bg-gray-50"
                      }`}
                  >
                    <span className="text-xs font-bold text-gray-300 mt-0.5 min-w-[1.5rem]">#{i + 1}</span>
                    <span className="flex-1 text-sm text-gray-700 group-hover:text-river-black font-medium leading-snug">{n.titulo}</span>
                    {n.url && (
                      <a
                        href={n.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-gray-300 hover:text-river-red transition-colors mt-0.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {textoOriginal === n.titulo && (
                      <Check className="w-4 h-4 text-river-red mt-0.5" />
                    )}
                  </button>
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* PASOS 2 y 3: Editor + Resultado */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Panel Izquierdo — Input */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-river-black flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-river-red" />
                Paso 2 — Noticia a transformar
              </h2>
              <span className="text-xs text-gray-400">{textoOriginal.length} caracteres</span>
            </div>

            <Textarea
              value={textoOriginal}
              onChange={(e) => setTextoOriginal(e.target.value)}
              placeholder="Seleccioná una noticia arriba o pegá el texto acá directamente..."
              className="min-h-[220px] resize-none text-base leading-relaxed border-gray-200 focus-visible:ring-river-red"
              disabled={estado === "procesando"}
            />

            {/* Foto de portada */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" /> Foto de portada <span className="font-normal text-gray-400">(opcional)</span>
              </p>
              {imagenPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                  <img
                    src={imagenPreview}
                    alt="Portada"
                    className="w-full h-36 object-cover"
                  />
                  {subiendoImagen && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full inline-block" />
                    </div>
                  )}
                  {!subiendoImagen && imagenPortada && (
                    <div className="absolute top-2 right-2">
                      <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" /> Subida
                      </span>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setImagenPortada(""); setImagenPreview(""); setErrorImagen(""); }}
                    className="absolute bottom-2 right-2 bg-white/90 hover:bg-white text-gray-700 h-7 gap-1 text-xs"
                  >
                    <Trash2 className="w-3 h-3" /> Quitar
                  </Button>
                </div>
              ) : (
                <label
                  className="flex flex-col items-center justify-center gap-2 w-full h-24 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-river-red hover:bg-red-50/30 transition-colors group"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) subirImagen(f); }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) subirImagen(f); }}
                  />
                  <Upload className="w-5 h-5 text-gray-300 group-hover:text-river-red transition-colors" />
                  <span className="text-xs text-gray-400 group-hover:text-gray-600 text-center">
                    Clic o arrastrá una imagen aquí
                  </span>
                  <span className="text-xs text-gray-300 group-hover:text-gray-400">
                    Se recorta automáticamente a 16:9 (1280×720)
                  </span>
                </label>
              )}
              {errorImagen && (
                <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-1.5">{errorImagen}</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={procesarNoticia}
                disabled={estado === "procesando" || textoOriginal.trim().length < 10}
                className="flex-1 h-12 text-base bg-river-red hover:bg-river-red-hover font-bold gap-2"
              >
                {estado === "procesando" ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    La IA está escribiendo...
                  </>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Transformar con IA</>
                )}
              </Button>
              {textoOriginal && (
                <Button variant="outline" size="icon" onClick={reiniciar} className="h-12 w-12">
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Panel Derecho — Output */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-river-black flex items-center gap-2 min-w-0">
                <Sparkles className="w-5 h-5 text-river-red flex-shrink-0" />
                Paso 3 — Aprobar y publicar
              </h2>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {resultado && !editando && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setEditando(true); setResultadoEditado(resultado); setActualizandoEstado("idle"); }}
                    className="gap-1 border-amber-400 text-amber-600 hover:bg-amber-50 h-8"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </Button>
                )}
                {resultado && !editando && (
                  <Button variant="outline" size="sm" onClick={copiar} className="gap-1 border-river-red text-river-red hover:bg-river-red hover:text-white h-8">
                    {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiado ? "¡Copiado!" : "Copiar"}
                  </Button>
                )}
              </div>
            </div>

            {/* Modo edición */}
            {editando ? (
              <motion.div key="edicion" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                {modoEdicionId && (
                  <p className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                    ✏️ Editando nota #{modoEdicionId} — viniste desde Telegram
                  </p>
                )}
                <Textarea
                  value={resultadoEditado}
                  onChange={(e) => setResultadoEditado(e.target.value)}
                  className="min-h-[280px] resize-none text-sm leading-relaxed font-mono border-amber-300 focus-visible:ring-amber-400"
                  placeholder="Editá el texto de la nota aquí..."
                />
                <p className="text-xs text-gray-400">
                  Formato: <code className="bg-gray-100 px-1 rounded">**Título:**</code>, <code className="bg-gray-100 px-1 rounded">**Contenido:**</code>, <code className="bg-gray-100 px-1 rounded">**Tags:**</code>
                </p>

                {/* Foto de portada en modo edición */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" /> Foto de portada <span className="font-normal text-gray-400">(podés cambiarla antes de publicar)</span>
                  </p>
                  {imagenPreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                      <img src={imagenPreview} alt="Portada" className="w-full h-32 object-cover" />
                      {subiendoImagen && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full inline-block" />
                        </div>
                      )}
                      {!subiendoImagen && imagenPortada && (
                        <div className="absolute top-2 right-2">
                          <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" /> OK
                          </span>
                        </div>
                      )}
                      <label className="absolute bottom-2 left-2 cursor-pointer">
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) subirImagen(f); }} />
                        <span className="bg-white/90 hover:bg-white text-gray-700 text-xs font-semibold px-2 py-1 rounded-lg flex items-center gap-1 transition-colors">
                          <Upload className="w-3 h-3" /> Cambiar foto
                        </span>
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setImagenPortada(""); setImagenPreview(""); setErrorImagen(""); }}
                        className="absolute bottom-2 right-2 bg-white/90 hover:bg-white text-gray-700 h-7 gap-1 text-xs"
                      >
                        <Trash2 className="w-3 h-3" /> Quitar
                      </Button>
                    </div>
                  ) : (
                    <label
                      className="flex flex-col items-center justify-center gap-2 w-full h-20 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-river-red hover:bg-red-50/30 transition-colors group"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) subirImagen(f); }}
                    >
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) subirImagen(f); }} />
                      <Upload className="w-5 h-5 text-gray-300 group-hover:text-river-red transition-colors" />
                      <span className="text-xs text-gray-400 group-hover:text-gray-600">Subir foto de portada (1280×720, recorte auto)</span>
                    </label>
                  )}
                  {errorImagen && (
                    <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-1.5">{errorImagen}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  {modoEdicionId ? (
                    <Button
                      onClick={actualizarYPublicar}
                      disabled={actualizandoEstado === "guardando" || actualizandoEstado === "guardado"}
                      className="flex-1 gap-2 bg-river-red hover:bg-river-red-hover text-white font-bold h-11"
                    >
                      {actualizandoEstado === "guardando" ? (
                        <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block" /> Publicando...</>
                      ) : actualizandoEstado === "guardado" ? (
                        <><Check className="w-4 h-4" /> ¡Publicada!</>
                      ) : (
                        <><Globe className="w-4 h-4" /> Guardar y Publicar</>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => { setResultado(resultadoEditado); setEditando(false); }}
                      className="flex-1 gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold h-11"
                    >
                      <Check className="w-4 h-4" /> Guardar cambios
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setEditando(false)}
                    className="gap-1 h-11 px-4"
                  >
                    <X className="w-4 h-4" /> Cancelar
                  </Button>
                </div>
                {actualizandoEstado === "error" && (
                  <p className="text-xs text-red-500 text-center bg-red-50 rounded-lg px-3 py-2">Error al guardar. Intentá de nuevo.</p>
                )}
                {actualizandoEstado === "guardado" && (
                  <p className="text-xs text-green-600 text-center font-semibold">✅ ¡La nota editada ya está publicada en el sitio!</p>
                )}

                {/* Ajustar imagen — solo si hay imagen cargada en modo edición */}
                {(imagenPortada || imagenPreview) && (
                  <>
                    <Button
                      variant="outline"
                      onClick={ajustarImagenConIA}
                      disabled={ajustandoImagen || subiendoImagen}
                      className={`w-full gap-2 h-10 text-sm transition-colors ${
                        imagenAjustada
                          ? "border-green-400 text-green-600 bg-green-50"
                          : "border-gray-200 text-gray-500 hover:border-river-red hover:text-river-red"
                      }`}
                    >
                      {ajustandoImagen ? (
                        <><span className="animate-spin w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full inline-block" /> Recortando a 1280×720...</>
                      ) : imagenAjustada ? (
                        <><Check className="w-3.5 h-3.5" /> ¡Imagen ajustada a 1280×720!</>
                      ) : (
                        <><Wand2 className="w-3.5 h-3.5" /> Ajustar imagen con IA</>
                      )}
                    </Button>
                    {errorImagen && (
                      <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-1.5 text-center">{errorImagen}</p>
                    )}
                  </>
                )}
              </motion.div>
            ) : (
              <AnimatePresence mode="wait">
                {!resultado ? (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="min-h-[220px] bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-center p-6"
                  >
                    <Sparkles className="w-8 h-8 text-gray-300 mb-3" />
                    <p className="text-gray-400 font-medium">El artículo aparecerá acá</p>
                    <p className="text-gray-300 text-sm mt-1">Transformá una noticia con IA</p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="resultado"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="min-h-[220px] bg-gray-50 rounded-xl p-4 relative overflow-hidden"
                  >
                    {estado === "procesando" && (
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-river-red/20">
                        <div className="h-full bg-river-red animate-pulse rounded-full" style={{ width: "60%" }} />
                      </div>
                    )}
                    <div ref={resultadoRef} className="prose prose-sm max-w-none">
                      {renderResultado(resultado)}
                      {estado === "procesando" && (
                        <span className="inline-block w-2 h-5 bg-river-red animate-pulse rounded ml-1" />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* Preview del artículo — aparece cuando hay imagen y el resultado está listo */}
            {estado === "listo" && !editando && imagenPreview && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl overflow-hidden border border-gray-200 shadow-sm"
              >
                <p className="text-xs font-semibold text-gray-400 px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center gap-1.5">
                  <ImageIcon className="w-3 h-3" /> Vista previa — así se verá en el sitio
                </p>
                <div className="relative">
                  <img
                    src={imagenPreview}
                    alt="Portada"
                    className="w-full aspect-video object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white font-display font-bold text-sm leading-snug line-clamp-2 drop-shadow">
                      {resultado.match(/\*\*Título:\*\*\s*(.+)/)?.[1]?.trim() ?? "Título de la nota"}
                    </p>
                    {imagenPortada && (
                      <span className="inline-block mt-1 text-xs text-green-300 font-medium">
                        ✓ Imagen 1280×720 lista
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {estado === "listo" && !editando && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                {/* Enviar a Telegram */}
                <Button
                  onClick={enviarTelegram}
                  disabled={telegramEstado === "enviando" || telegramEstado === "enviado"}
                  className="w-full gap-2 bg-[#229ED9] hover:bg-[#1a8bbf] text-white font-bold h-12"
                >
                  {telegramEstado === "enviando" ? (
                    <>
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Enviando a Telegram...
                    </>
                  ) : telegramEstado === "enviado" ? (
                    <><Check className="w-4 h-4" /> ¡Revisá tu Telegram para aprobar!</>
                  ) : (
                    <><Send className="w-4 h-4" /> Enviar a Telegram para aprobar</>
                  )}
                </Button>
                {telegramEstado === "error" && (
                  <p className="text-xs text-red-500 text-center bg-red-50 rounded-lg px-3 py-2">{telegramError}</p>
                )}
                {telegramEstado === "enviado" && (
                  <p className="text-xs text-green-600 text-center">
                    📱 La nota llegó a tu Telegram con botones ✅ <strong>Publicar</strong> / ✏️ <strong>Editar</strong> / ❌ <strong>Rechazar</strong>. ¡Aprobá desde el celular!
                  </p>
                )}

                {/* Publicar en el sitio */}
                <Button
                  onClick={publicarEnSitio}
                  disabled={publicarEstado === "publicando" || publicarEstado === "publicado"}
                  className="w-full gap-2 bg-river-red hover:bg-river-red-hover text-white font-bold h-12"
                >
                  {publicarEstado === "publicando" ? (
                    <>
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Publicando...
                    </>
                  ) : publicarEstado === "publicado" ? (
                    <><Check className="w-4 h-4" /> ¡Publicada en el sitio!</>
                  ) : (
                    <><Globe className="w-4 h-4" /> Publicar en el sitio web</>
                  )}
                </Button>
                {publicarEstado === "error" && (
                  <p className="text-xs text-red-500 text-center bg-red-50 rounded-lg px-3 py-2">{publicarError}</p>
                )}
                {publicarEstado === "publicado" && (
                  <p className="text-xs text-green-600 text-center font-semibold">
                    ✅ ¡La nota ya está visible en la sección Actualidad del sitio!
                  </p>
                )}

                {/* Ajustar imagen — solo si hay imagen cargada */}
                {(imagenPortada || imagenPreview) && (
                  <>
                    <Button
                      variant="outline"
                      onClick={ajustarImagenConIA}
                      disabled={ajustandoImagen || subiendoImagen}
                      className={`w-full gap-2 h-10 text-sm transition-colors ${
                        imagenAjustada
                          ? "border-green-400 text-green-600 bg-green-50"
                          : "border-gray-200 text-gray-500 hover:border-river-red hover:text-river-red"
                      }`}
                    >
                      {ajustandoImagen ? (
                        <><span className="animate-spin w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full inline-block" /> Recortando a 1280×720...</>
                      ) : imagenAjustada ? (
                        <><Check className="w-3.5 h-3.5" /> ¡Imagen ajustada a 1280×720!</>
                      ) : (
                        <><Wand2 className="w-3.5 h-3.5" /> Ajustar imagen con IA</>
                      )}
                    </Button>
                    {errorImagen && (
                      <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-1.5 text-center">{errorImagen}</p>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </div>
        </div>

        {/* ── POSTULANTES ───────────────────────────────────────────────── */}
        {tab === "postulantes" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="font-display text-xl font-bold text-river-black flex items-center gap-2">
                  <Inbox className="w-5 h-5 text-river-red" /> Bandeja de Postulantes
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {postulaciones.filter(p => p.pendiente).length} pendientes · {postulaciones.filter(p => p.publicada).length} publicadas
                </p>
              </div>
              <button onClick={cargarPostulaciones} disabled={cargandoPostul}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-river-red transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${cargandoPostul ? "animate-spin" : ""}`} /> Actualizar
              </button>
            </div>

            {errorPostul && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {errorPostul}
              </div>
            )}

            {cargandoPostul && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 animate-pulse">
                      <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
                      <div className="h-3 bg-gray-100 rounded w-1/3" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!cargandoPostul && postulaciones.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <Inbox className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-semibold">Ninguna postulación todavía</p>
                <p className="text-sm mt-1">Cuando alguien complete el formulario "Escribí en el sitio", aparecerá aquí.</p>
              </div>
            )}

            {!cargandoPostul && postulaciones.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">

                {/* Lista (columna izquierda) */}
                <div className="space-y-2 md:max-h-[600px] md:overflow-y-auto pr-1">
                  {postulaciones.map(p => {
                    const { nombre, ciudad, tipo } = parsearPostul(p);
                    const accion = accionPostul[p.id];
                    const esSel = postulSel?.id === p.id;
                    return (
                      <button key={p.id} onClick={() => setPostulSel(p)}
                        className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                          esSel
                            ? "bg-river-red/8 border-river-red/40 shadow-sm"
                            : "bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-river-black truncate">{nombre}</p>
                            <p className="text-xs text-gray-500 truncate">{ciudad} · {tipo}</p>
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-1">
                            {p.publicada && <span className="text-[9px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded">PUBLICADA</span>}
                            {!p.publicada && !p.pendiente && <span className="text-[9px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded">RECHAZADA</span>}
                            {p.pendiente && (accion === "ok" ? <span className="text-[9px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded">PUBLICADA</span> : accion === "rechazado" ? <span className="text-[9px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded">RECHAZADA</span> : <span className="text-[9px] bg-river-red/10 text-river-red font-bold px-1.5 py-0.5 rounded">PENDIENTE</span>)}
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 truncate">
                          {p.textoOriginal?.slice(0, 60)}{p.textoOriginal?.length > 60 ? "..." : ""}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Detalle (columna derecha) */}
                <div className="md:col-span-2">
                  {!postulSel ? (
                    <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400">
                      <Eye className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p>Seleccioná una postulación para ver el detalle</p>
                    </div>
                  ) : (() => {
                    const { nombre, ciudad, tipo, link } = parsearPostul(postulSel);
                    const accion = accionPostul[postulSel.id];
                    const isPending = postulSel.pendiente && accion !== "ok" && accion !== "rechazado";
                    return (
                      <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-4">
                          <div>
                            <h3 className="font-display font-bold text-xl text-river-black">{nombre}</h3>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className="text-sm text-gray-500">{ciudad}</span>
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{tipo}</span>
                              {link && (
                                <a href={link} target="_blank" rel="noreferrer"
                                  className="text-xs text-river-red font-medium flex items-center gap-1 hover:underline">
                                  <ExternalLink className="w-3 h-3" /> Ver canal / redes
                                </a>
                              )}
                            </div>
                          </div>
                          {postulSel.publicada || accion === "ok" ? (
                            <span className="flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-bold px-3 py-1.5 rounded-lg">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Publicada
                            </span>
                          ) : (!postulSel.pendiente || accion === "rechazado") ? (
                            <span className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 text-gray-500 text-xs font-bold px-3 py-1.5 rounded-lg">
                              <XCircle className="w-3.5 h-3.5" /> Rechazada
                            </span>
                          ) : null}
                        </div>

                        {/* Texto original */}
                        {postulSel.textoOriginal && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Texto original del autor</p>
                            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto">
                              {postulSel.textoOriginal}
                            </div>
                          </div>
                        )}

                        {/* Texto corregido por IA */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Texto corregido por IA (listo para publicar)</p>
                          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                            {postulSel.contenido}
                          </div>
                        </div>

                        {/* Acciones */}
                        {isPending && (
                          <div className="flex gap-3 pt-2">
                            <Button onClick={() => publicarPostulacion(postulSel)}
                              disabled={accion === "publicando"}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold flex items-center gap-2">
                              {accion === "publicando" ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                              Publicar con su firma
                            </Button>
                            <Button onClick={() => rechazarPostulacion(postulSel)}
                              disabled={accion === "rechazando"}
                              variant="outline"
                              className="flex-1 border-red-200 text-red-600 hover:bg-red-50 font-bold flex items-center gap-2">
                              {accion === "rechazando" ? <div className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" /> : <XCircle className="w-4 h-4" />}
                              Rechazar
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <div className="mt-8 bg-river-black text-white rounded-2xl p-6 md:p-8">
          <h3 className="font-display text-xl font-bold mb-3 text-river-red">Cómo funciona el Prompt Maestro</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm text-gray-300">
            <div>
              <p className="font-bold text-white mb-1">🔍 Scraper directo</p>
              <p>Busca los últimos titulares de TyC Sports u Olé en tiempo real, sin tener que copiar links.</p>
            </div>
            <div>
              <p className="font-bold text-white mb-1">🕐 Horario israelí</p>
              <p>Si la noticia menciona hora argentina, la IA calcula automáticamente el horario israelí (+6hs).</p>
            </div>
            <div>
              <p className="font-bold text-white mb-1">🇮🇱 Contexto local</p>
              <p>La IA menciona la Filial Ramat Gan e invita a los hinchas en Israel a unirse.</p>
            </div>
            <div>
              <p className="font-bold text-white mb-1">📱 Privacidad total</p>
              <p>La nota te llega solo a vos por Telegram. El público solo ve el sitio terminado.</p>
            </div>
          </div>
        </div>

        </>}

        {/* ── ANALYTICS ────────────────────────────────────────────────── */}
        {tab === "analytics" && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-display font-bold text-gray-900">Estadísticas del sitio</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {analytics
                    ? `Actualizado el ${new Date(analytics.fetchedAt).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · ${analytics.fromCache ? "desde caché" : "datos frescos"}`
                    : "Se actualizan automáticamente cada 12 horas"}
                </p>
              </div>
              <button
                onClick={() => cargarAnalytics(true)}
                disabled={cargandoAnalytics}
                className="flex items-center gap-2 px-4 py-2 bg-river-red text-white rounded-lg text-sm font-semibold hover:bg-river-red/90 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${cargandoAnalytics ? "animate-spin" : ""}`} />
                {cargandoAnalytics ? "Cargando..." : "Actualizar ahora"}
              </button>
            </div>

            {errorAnalytics && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{errorAnalytics}</div>
            )}

            {cargandoAnalytics && !analytics && (
              <div className="text-center py-16 text-gray-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
                <p>Cargando estadísticas...</p>
              </div>
            )}

            {analytics && (
              <>
                {/* Tarjetas principales */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Noticias publicadas", value: analytics.noticias.publicadas, color: "bg-green-50 border-green-200 text-green-700", icon: "✅" },
                    { label: "En revisión (Telegram)", value: analytics.noticias.pendientes, color: "bg-yellow-50 border-yellow-200 text-yellow-700", icon: "⏳" },
                    { label: "Rechazadas", value: analytics.noticias.rechazadas, color: "bg-red-50 border-red-200 text-red-700", icon: "❌" },
                    { label: "Total generadas", value: analytics.noticias.total, color: "bg-blue-50 border-blue-200 text-blue-700", icon: "🤖" },
                  ].map(card => (
                    <div key={card.label} className={`border rounded-2xl p-5 ${card.color}`}>
                      <div className="text-2xl mb-1">{card.icon}</div>
                      <div className="text-3xl font-bold font-display">{card.value}</div>
                      <div className="text-xs font-medium mt-1 opacity-80">{card.label}</div>
                    </div>
                  ))}
                </div>

                {/* Contenido */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Fotos en galería", value: analytics.galeria.fotos, icon: "🖼️", color: "bg-purple-50 border-purple-200 text-purple-700" },
                    { label: "Videos en galería", value: analytics.videos.total, icon: "🎬", color: "bg-indigo-50 border-indigo-200 text-indigo-700" },
                  ].map(card => (
                    <div key={card.label} className={`border rounded-2xl p-5 ${card.color}`}>
                      <div className="text-2xl mb-1">{card.icon}</div>
                      <div className="text-3xl font-bold font-display">{card.value}</div>
                      <div className="text-xs font-medium mt-1 opacity-80">{card.label}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Fuentes */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6">
                    <h3 className="font-display font-bold text-gray-900 mb-4">Noticias publicadas por fuente</h3>
                    {analytics.fuentes.length === 0 ? (
                      <p className="text-sm text-gray-400">Sin datos aún</p>
                    ) : (
                      <div className="space-y-3">
                        {(() => {
                          const max = Math.max(...analytics.fuentes.map(f => f.cantidad));
                          return analytics.fuentes.map(f => (
                            <div key={f.fuente}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium text-gray-700">{f.fuente}</span>
                                <span className="text-gray-500">{f.cantidad}</span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-river-red rounded-full transition-all"
                                  style={{ width: `${(f.cantidad / max) * 100}%` }}
                                />
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Por mes */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6">
                    <h3 className="font-display font-bold text-gray-900 mb-4">Publicaciones por mes</h3>
                    {analytics.porMes.length === 0 ? (
                      <p className="text-sm text-gray-400">Sin datos aún</p>
                    ) : (
                      <div className="space-y-3">
                        {(() => {
                          const max = Math.max(...analytics.porMes.map(m => m.cantidad));
                          return analytics.porMes.map(m => {
                            const [anio, mes] = m.mes.split("-");
                            const nombre = new Date(Number(anio), Number(mes) - 1).toLocaleString("es-AR", { month: "long", year: "numeric" });
                            return (
                              <div key={m.mes}>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="font-medium text-gray-700 capitalize">{nombre}</span>
                                  <span className="text-gray-500">{m.cantidad}</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 rounded-full transition-all"
                                    style={{ width: `${(m.cantidad / max) * 100}%` }}
                                  />
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Últimas noticias */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6">
                  <h3 className="font-display font-bold text-gray-900 mb-4">Últimas 10 noticias publicadas</h3>
                  <div className="divide-y divide-gray-100">
                    {analytics.ultimas.map((n, i) => (
                      <div key={i} className="py-3 flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{n.titulo}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{n.fuente}</p>
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {new Date(n.fecha).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── FOTOS DE GALERÍA ─────────────────────────────────────────── */}
        {tab === "galeria" && <GaleriaTab />}

        {/* ── VIDEOS DE GALERÍA ────────────────────────────────────────── */}
        {tab === "videos" && <VideosTab />}
      </div>
    </div>
  );
}
