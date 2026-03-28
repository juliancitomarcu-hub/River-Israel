import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Copy, Check, RotateCcw, Newspaper, ChevronDown, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Estado = "idle" | "procesando" | "listo" | "error";
type EstadoTelegram = "idle" | "enviando" | "enviado" | "error";

export default function Redactor() {
  const [textoOriginal, setTextoOriginal] = useState("");
  const [resultado, setResultado] = useState("");
  const [estado, setEstado] = useState<Estado>("idle");
  const [copiado, setCopiado] = useState(false);
  const [telegramEstado, setTelegramEstado] = useState<EstadoTelegram>("idle");
  const [telegramError, setTelegramError] = useState("");
  const resultadoRef = useRef<HTMLDivElement>(null);

  const ejemplos = [
    "River Plate goleó 4-0 a Estudiantes de La Plata este sábado a las 20:00hs en el Estadio Monumental. Marcelo Borja convirtió un hat-trick mientras que Nacho Fernández cerró la cuenta con un golazo desde afuera del área. Con este resultado, el Millonario se consolida en la cima de la Liga Profesional.",
    "Marcelo Gallardo regresa a River Plate como Director Técnico. El acuerdo fue anunciado oficialmente por el club este martes. El Muñeco firmó contrato por dos temporadas y ya comienza a preparar el equipo para la Copa Libertadores.",
    "River Plate empató 1-1 con Boca Juniors en un Superclásico vibrante jugado el domingo a las 15:30hs. Palabras del técnico tras el partido: 'El equipo lo dio todo, merecíamos más.' El gol del empate llegó a los 88 minutos.",
  ];

  const procesarNoticia = async () => {
    if (!textoOriginal.trim() || textoOriginal.trim().length < 10) return;

    setEstado("procesando");
    setResultado("");

    try {
      const response = await fetch("/api/procesar-noticia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: textoOriginal }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Error en la respuesta del servidor");
      }

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
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                setResultado((prev) => prev + data.content);
                resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
              }
              if (data.done) {
                setEstado("listo");
              }
              if (data.error) {
                setEstado("error");
              }
            } catch {
              // ignore parse errors for incomplete chunks
            }
          }
        }
      }

      if (estado !== "error") setEstado("listo");
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

  const usarEjemplo = (ejemplo: string) => {
    setTextoOriginal(ejemplo);
    setResultado("");
    setEstado("idle");
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
        return <p key={i} className="text-sm font-bold text-river-red mb-2 uppercase tracking-widest">Nota para el sitio</p>;
      }
      if (line.startsWith("**Tags:**")) {
        return (
          <p key={i} className="mt-4 text-river-red font-semibold text-sm">
            {line.replace("**Tags:**", "").trim()}
          </p>
        );
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-river-red/10 text-river-red px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-4 h-4" />
            Panel IA — River en Israel
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-river-black mb-4">
            Redactor de <span className="text-river-red">Noticias</span> con IA
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Pegá una noticia cruda de <strong>Olé, TyC Sports o cualquier fuente</strong> y la IA la transforma
            al estilo "River en Israel" con horario israelí, contexto de la filial y llamado a la acción.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Panel Izquierdo — Input */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-river-black flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-river-red" />
                Noticia Original
              </h2>
              <span className="text-xs text-gray-400">{textoOriginal.length} caracteres</span>
            </div>

            <Textarea
              value={textoOriginal}
              onChange={(e) => setTextoOriginal(e.target.value)}
              placeholder="Pegá acá la noticia de Olé, TyC Sports, o cualquier fuente... Por ejemplo: 'River goleó 3-0 a Boca en el Monumental este domingo a las 17hs...'"
              className="min-h-[280px] resize-none text-base leading-relaxed border-gray-200 focus-visible:ring-river-red"
              disabled={estado === "procesando"}
            />

            <Button
              onClick={procesarNoticia}
              disabled={estado === "procesando" || textoOriginal.trim().length < 10}
              className="w-full h-14 text-lg bg-river-red hover:bg-river-red-hover font-bold gap-2"
            >
              {estado === "procesando" ? (
                <>
                  <span className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  La IA está escribiendo...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Transformar con IA
                </>
              )}
            </Button>

            {/* Ejemplos */}
            <div>
              <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                <ChevronDown className="w-3 h-3" /> Probá con un ejemplo:
              </p>
              <div className="space-y-2">
                {ejemplos.map((ej, i) => (
                  <button
                    key={i}
                    onClick={() => usarEjemplo(ej)}
                    className="w-full text-left text-xs text-gray-500 hover:text-river-red bg-white border border-gray-200 hover:border-river-red/30 rounded-lg px-3 py-2 transition-colors line-clamp-2"
                  >
                    <span className="font-bold text-river-red mr-1">#{i + 1}</span> {ej.slice(0, 90)}...
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Panel Derecho — Output */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-river-black flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-river-red" />
                Nota Lista para Publicar
              </h2>
              {(estado === "listo" || resultado) && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copiar} className="gap-1 border-river-red text-river-red hover:bg-river-red hover:text-white">
                    {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiado ? "¡Copiado!" : "Copiar"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={reiniciar} className="gap-1">
                    <RotateCcw className="w-4 h-4" />
                    Nueva
                  </Button>
                </div>
              )}
            </div>

            <AnimatePresence mode="wait">
              {estado === "idle" && !resultado ? (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="min-h-[400px] bg-white border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-center p-8"
                >
                  <div className="w-16 h-16 bg-river-red/10 rounded-full flex items-center justify-center mb-4">
                    <Sparkles className="w-8 h-8 text-river-red/50" />
                  </div>
                  <p className="text-gray-400 text-lg font-medium">El artículo aparecerá acá</p>
                  <p className="text-gray-300 text-sm mt-2">Pegá una noticia y hacé clic en "Transformar con IA"</p>
                </motion.div>
              ) : (
                <motion.div
                  key="resultado"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="min-h-[400px] bg-white border border-gray-200 rounded-xl p-6 shadow-sm relative overflow-hidden"
                >
                  {estado === "procesando" && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-river-red/20">
                      <div className="h-full bg-river-red animate-pulse rounded-full" style={{ width: "60%" }} />
                    </div>
                  )}

                  <div ref={resultadoRef} className="prose prose-sm max-w-none">
                    {renderResultado(resultado)}
                    {estado === "procesando" && (
                      <span className="inline-block w-2 h-5 bg-river-red animate-pulse rounded ml-1" />
                    )}
                  </div>

                  {estado === "listo" && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6 pt-4 border-t border-gray-100 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Nota lista para publicar
                        </span>
                        <span className="text-xs text-gray-400">Generada con IA · River en Israel</span>
                      </div>
                      <Button
                        onClick={enviarTelegram}
                        disabled={telegramEstado === "enviando" || telegramEstado === "enviado"}
                        className="w-full gap-2 bg-[#229ED9] hover:bg-[#1a8bbf] text-white font-bold"
                      >
                        {telegramEstado === "enviando" ? (
                          <>
                            <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                            Enviando a Telegram...
                          </>
                        ) : telegramEstado === "enviado" ? (
                          <>
                            <Check className="w-4 h-4" /> ¡Enviado a tu Telegram!
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" /> Enviar a mi Telegram
                          </>
                        )}
                      </Button>
                      {telegramEstado === "error" && (
                        <p className="text-xs text-red-500 text-center">{telegramError}</p>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Info box */}
        <div className="mt-12 bg-river-black text-white rounded-2xl p-6 md:p-8">
          <h3 className="font-display text-xl font-bold mb-3 text-river-red">¿Cómo funciona el Prompt Maestro?</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-300">
            <div>
              <p className="font-bold text-white mb-1">🕐 Horario israelí</p>
              <p>Si la noticia menciona hora argentina, la IA calcula automáticamente el horario de Israel (+6 horas).</p>
            </div>
            <div>
              <p className="font-bold text-white mb-1">🇮🇱 Contexto local</p>
              <p>La IA menciona naturalmente a la Filial Ramat Gan e invita a los hinchas en Israel a unirse.</p>
            </div>
            <div>
              <p className="font-bold text-white mb-1">⚽ Estilo riverplatense</p>
              <p>Redacción en español rioplatense, apasionado, con términos como "El Millo" o "La Banda".</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
