import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { X, ZoomIn, Image as ImageIcon, AlertCircle } from "lucide-react";

interface GaleriaFoto {
  id: number;
  url: string;
  caption: string;
  orden: number;
}

interface GaleriaResponse {
  fotos: GaleriaFoto[];
}

function resolverUrlGaleria(url: string) {
  if (url.startsWith("/objects/")) return `/api/storage/objects${url.slice(8)}`;
  if (url.startsWith("/images/")) return `${import.meta.env.BASE_URL}${url.slice(1)}`;
  return url;
}

export default function Galeria() {
  const { data: fotos = [], isLoading, isError } = useQuery<GaleriaFoto[]>({
    queryKey: ["galeria", "river"],
    queryFn: async () => {
      const res = await fetch("/api/galeria?categoria=river");
      if (!res.ok) throw new Error("No se pudo cargar la galería");
      const data = await res.json() as GaleriaResponse;
      return data.fotos ?? [];
    }
  });

  const [fotoSeleccionada, setFotoSeleccionada] = useState<GaleriaFoto | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const cerrarVisor = useCallback(() => {
    setFotoSeleccionada(null);
    window.requestAnimationFrame(() => previousFocusRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!fotoSeleccionada) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cerrarVisor();
      }
      if (e.key === "Tab") {
        e.preventDefault();
        closeButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [fotoSeleccionada, cerrarVisor]);

  return (
    <div className="w-full bg-[#FAFAF8] newspaper-texture min-h-screen">
      
      {/* CABECERA DE GALERÍA */}
      <section className="border-b-2 border-tinta bg-white pt-24 pb-12 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="border-l-8 border-river-red pl-6 md:pl-8">
            <div className="flex items-center gap-3 mb-4 text-river-red">
              <ImageIcon className="w-6 h-6" />
              <span className="font-mono text-sm uppercase tracking-widest font-bold">Archivo Visual</span>
            </div>
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl tracking-tighter text-tinta leading-none mb-4">
              LA BANDA EN <span className="text-river-red">IMÁGENES</span>
            </h1>
            <p className="text-lg md:text-xl text-gris-meta max-w-3xl leading-relaxed">
              La memoria visual de nuestra filial. Cada bandera, cada abrazo y cada grito sagrado desde Tierra Santa guardados para la historia.
            </p>
          </div>
        </div>
      </section>

      {/* CONTENIDO */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 min-h-[50vh]">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <div className="w-12 h-12 border-4 border-gris-borde border-t-river-red rounded-full animate-spin" />
            <p className="font-mono text-gris-meta uppercase tracking-widest text-sm">Revelando archivo...</p>
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-white border-2 border-tinta p-8 text-center">
            <AlertCircle className="w-12 h-12 text-river-red" />
            <p className="font-display text-3xl text-tinta">Error de revelado</p>
            <p className="text-gris-meta font-mono text-sm uppercase tracking-wider">No se pudo cargar la galería. Intentá nuevamente.</p>
          </div>
        )}

        {!isLoading && !isError && fotos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-white border-2 border-tinta p-8 text-center">
            <ImageIcon className="w-12 h-12 text-gris-borde" />
            <p className="font-display text-3xl text-tinta">Archivo vacío</p>
            <p className="text-gris-meta font-mono text-sm uppercase tracking-wider">Aún no hay imágenes en la galería de la filial.</p>
          </div>
        )}

        {!isLoading && !isError && fotos.length > 0 && (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-8 space-y-8">
            {[...fotos].sort((a, b) => a.orden - b.orden).map((foto, idx) => (
              <motion.figure
                key={foto.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (idx % 6) * 0.1, duration: 0.6, ease: "easeOut" }}
                className="break-inside-avoid relative group overflow-hidden bg-white border-2 border-tinta p-3 pb-16 shadow-lg hover:shadow-xl hover:border-river-red transition-all duration-300"
              >
                <button
                  type="button"
                  onClick={(event) => {
                    previousFocusRef.current = event.currentTarget;
                    setFotoSeleccionada(foto);
                  }}
                  className="block w-full overflow-hidden relative bg-gris-borde border border-gris-borde text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-river-red/40"
                  aria-label={`Ampliar foto: ${foto.caption || "Memoria visual de la filial"}`}
                  data-testid={`button-gallery-photo-${foto.id}`}
                >
                  <img
                    src={resolverUrlGaleria(foto.url)}
                    alt={foto.caption}
                    className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-river-red/0 group-hover:bg-river-red/20 transition-colors duration-500 flex items-center justify-center">
                    <div className="bg-tinta text-white rounded-full p-4 opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all duration-300 shadow-xl">
                      <ZoomIn className="w-6 h-6" />
                    </div>
                  </div>
                </button>
                <figcaption className="absolute bottom-0 left-0 right-0 p-4 bg-white">
                  <p className="font-mono text-xs text-tinta line-clamp-2 leading-snug font-bold">
                    {foto.caption || "Sin descripción"}
                  </p>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        )}
      </section>

      {/* VISOR AMPLIADO */}
      <AnimatePresence>
        {fotoSeleccionada && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-tinta/95 backdrop-blur-md p-4 md:p-8"
            onClick={cerrarVisor}
            role="dialog"
            aria-modal="true"
            aria-label={fotoSeleccionada.caption || "Vista ampliada de la galería"}
          >
            <button
                ref={closeButtonRef}
                onClick={cerrarVisor}
              className="absolute top-4 right-4 md:top-8 md:right-8 text-white/50 hover:text-white bg-black/50 hover:bg-river-red rounded-full p-3 transition-colors z-10"
              aria-label="Cerrar vista ampliada"
              data-testid="button-close-gallery-viewer"
            >
              <X className="w-6 h-6" />
            </button>
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative max-w-6xl w-full max-h-[90vh] flex flex-col bg-white border-4 border-river-red shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative flex-1 overflow-hidden min-h-0 bg-[#050505] flex items-center justify-center border-b-2 border-tinta p-2">
                <img
                  src={resolverUrlGaleria(fotoSeleccionada.url)}
                  alt={fotoSeleccionada.caption}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              </div>
              <div className="bg-white p-6 md:p-8 shrink-0">
                <p className="font-display text-2xl md:text-4xl text-tinta leading-tight mb-2">
                  {fotoSeleccionada.caption || "Memoria visual de la filial"}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-river-red font-mono text-[10px] md:text-xs uppercase tracking-widest font-bold">
                    <ImageIcon className="w-4 h-4" />
                    <span>Archivo River en Israel</span>
                  </div>
                  <div className="text-gris-meta font-mono text-[10px] md:text-xs uppercase tracking-widest">
                    #{fotoSeleccionada.id.toString().padStart(4, '0')}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
