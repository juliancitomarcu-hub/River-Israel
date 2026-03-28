import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Copy, Check, RotateCcw, Newspaper,
  Send, Search, ExternalLink, RefreshCw, ChevronDown, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Estado = "idle" | "procesando" | "listo" | "error";
type EstadoTelegram = "idle" | "enviando" | "enviado" | "error";
type EstadoPublicar = "idle" | "publicando" | "publicado" | "error";
type FuenteNoticias = "tyc" | "ole";

interface NoticiaRaw {
  titulo: string;
  url: string;
  fuente: string;
}

export default function Redactor() {
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
      const res = await fetch("/api/enviar-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: resultado }),
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
            Buscá la última noticia de TyC o Olé, la IA la transforma al estilo israelí,
            y te la manda directo a tu Telegram privado.
          </p>
        </div>

        {/* Flujo 3 pasos */}
        <div className="flex items-center justify-center gap-3 mb-10 text-xs font-bold uppercase tracking-wider text-gray-400">
          <span className="flex items-center gap-1.5 text-river-red"><span className="w-6 h-6 rounded-full bg-river-red text-white flex items-center justify-center text-xs">1</span> Buscar noticia</span>
          <span className="text-gray-200">──────</span>
          <span className="flex items-center gap-1.5"><span className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs">2</span> Transformar con IA</span>
          <span className="text-gray-200">──────</span>
          <span className="flex items-center gap-1.5"><span className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs">3</span> Enviar a Telegram</span>
        </div>

        {/* PASO 1: Buscador de noticias */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="font-display text-lg font-bold text-river-black mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-river-red" />
            Paso 1 — Buscar última noticia
          </h2>

          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex rounded-xl overflow-hidden border border-gray-200">
              <button
                onClick={() => setFuente("tyc")}
                className={`px-5 py-2.5 text-sm font-bold transition-colors ${fuente === "tyc" ? "bg-river-red text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              >
                TyC Sports
              </button>
              <button
                onClick={() => setFuente("ole")}
                className={`px-5 py-2.5 text-sm font-bold transition-colors ${fuente === "ole" ? "bg-river-red text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              >
                Olé
              </button>
            </div>

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
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-river-black flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-river-red" />
                Paso 3 — Nota lista y Telegram
              </h2>
              {resultado && (
                <Button variant="outline" size="sm" onClick={copiar} className="gap-1 border-river-red text-river-red hover:bg-river-red hover:text-white h-8">
                  {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiado ? "¡Copiado!" : "Copiar"}
                </Button>
              )}
            </div>

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

            {estado === "listo" && (
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
                    <><Check className="w-4 h-4" /> ¡Llegó a tu Telegram!</>
                  ) : (
                    <><Send className="w-4 h-4" /> Previsualizar en Telegram</>
                  )}
                </Button>
                {telegramEstado === "error" && (
                  <p className="text-xs text-red-500 text-center bg-red-50 rounded-lg px-3 py-2">{telegramError}</p>
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
      </div>
    </div>
  );
}
