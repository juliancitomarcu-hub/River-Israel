import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Copy, Check, RotateCcw, Newspaper,
  Send, Search, ExternalLink, RefreshCw, ChevronDown, Globe, Pencil, X, ImageIcon, Upload, Trash2,
  BookOpen, CalendarDays, AlertTriangle, Wand2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Tab = "redactor" | "publicaciones";
type Estado = "idle" | "procesando" | "listo" | "error";
type EstadoTelegram = "idle" | "enviando" | "enviado" | "error";
type EstadoPublicar = "idle" | "publicando" | "publicado" | "error";
type FuenteNoticias = "tyc" | "ole" | "infobae" | "clarin" | "lanacion" | "bolavip" | "as" | "superdeportivo";

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

  // Mis publicaciones
  const [misPublicaciones, setMisPublicaciones] = useState<NoticiaPublicada[]>([]);
  const [cargandoPublicaciones, setCargandoPublicaciones] = useState(false);
  const [errorPublicaciones, setErrorPublicaciones] = useState("");
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);
  const [confirmEliminarId, setConfirmEliminarId] = useState<number | null>(null);

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
    setErrorImagen("");
    try {
      let blob: Blob;
      if (imagenPortada) {
        const res = await fetch(`/api/storage${imagenPortada}`);
        if (!res.ok) throw new Error("No se pudo cargar la imagen");
        blob = await res.blob();
      } else {
        const res = await fetch(imagenPreview);
        blob = await res.blob();
      }
      const file = new File([blob], "portada.jpg", { type: blob.type || "image/jpeg" });
      await subirImagen(file);
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
                  <Button
                    variant="outline"
                    onClick={ajustarImagenConIA}
                    disabled={ajustandoImagen || subiendoImagen}
                    className="w-full gap-2 h-10 text-sm border-gray-200 text-gray-500 hover:border-river-red hover:text-river-red"
                  >
                    {ajustandoImagen ? (
                      <><span className="animate-spin w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full inline-block" /> Ajustando imagen...</>
                    ) : (
                      <><Wand2 className="w-3.5 h-3.5" /> Ajustar imagen con IA</>
                    )}
                  </Button>
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
                  <Button
                    variant="outline"
                    onClick={ajustarImagenConIA}
                    disabled={ajustandoImagen || subiendoImagen}
                    className="w-full gap-2 h-10 text-sm border-gray-200 text-gray-500 hover:border-river-red hover:text-river-red"
                  >
                    {ajustandoImagen ? (
                      <><span className="animate-spin w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full inline-block" /> Ajustando imagen...</>
                    ) : (
                      <><Wand2 className="w-3.5 h-3.5" /> Ajustar imagen con IA</>
                    )}
                  </Button>
                )}
                {errorImagen && (
                  <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-1.5 text-center">{errorImagen}</p>
                )}
              </motion.div>
            )}
          </div>
        </div>

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
      </div>
    </div>
  );
}
