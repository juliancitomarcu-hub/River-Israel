import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ArrowLeft, Tag, MessageCircle, Send, User, Heart, ThumbsUp, Share2, Quote, Check } from "lucide-react";
import ShareButton from "@/components/ShareButton";
import { useNews, resolverPortada, limpiarAsteriscos, type NewsItem } from "@/hooks/use-river-data";
import { setPageMeta, resetPageMeta, extraerDescripcion } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { relatedNews } from "@/lib/related-news";

interface Comentario {
  id: number;
  autor: string;
  contenido: string;
  createdAt: string;
}

interface NoticiaCompleta {
  id: number;
  titulo: string;
  contenido: string;
  tags: string;
  fuente: string;
  textoOriginal: string;
  imagenPortada?: string;
  imagenInstagram?: string;
  createdAt: string;
  categoria?: "river" | "seleccion";
  tituloHe?: string;
  contenidoHe?: string;
  tagsHe?: string;
  hebreoPublicada?: boolean;
}

const IMAGENES = [
  "https://images.unsplash.com/photo-1518605368461-1e122c4cdce0?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1556056504-5c7696c4c28d?q=80&w=2076&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1517466787929-bc90951d0974?q=80&w=2069&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=2070&auto=format&fit=crop",
];

function formatearFecha(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function renderContenido(texto: string) {
  return limpiarAsteriscos(texto).split("\n").map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} className="h-4" />;

    if (trimmed.startsWith("•")) {
      return (
        <li key={i} className="text-tinta text-lg leading-relaxed ml-4 list-disc marker:text-river-red">
          {trimmed.replace(/^•\s*/, "")}
        </li>
      );
    }

    if (trimmed.startsWith("#")) {
      return (
        <p key={i} className="text-river-red font-semibold text-sm mt-2">
          {trimmed}
        </p>
      );
    }

    return (
      <p key={i} className="text-tinta text-lg leading-relaxed">
        {trimmed}
      </p>
    );
  });
}

function FloatingWhatsAppShare({ titulo, id }: { titulo: string; id: number }) {
  const canonicalUrl =
    typeof window !== "undefined"
      ? new URL(`/noticia/${id}`, window.location.origin).toString()
      : `/noticia/${id}`;
  const shareText = `${titulo}\n${canonicalUrl}`;
  const href = `whatsapp://send?text=${encodeURIComponent(shareText)}`;

  return (
    <a
      href={href}
      aria-label="Compartir esta noticia en WhatsApp"
      title="Compartir en WhatsApp"
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-50 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40 active:scale-95 sm:right-6"
    >
      <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.198.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
      <span>Compartir en WhatsApp</span>
    </a>
  );
}

// ══════════════════════════════════════════════════════════════
// REACCIONES CLIENT-SIDE (localStorage)
// ══════════════════════════════════════════════════════════════
type ReaccionTipo = "like" | "love";

function useReacciones(noticiaId: number) {
  const [reacciones, setReacciones] = useState<{ like: number; love: number }>({ like: 0, love: 0 });
  const [miReaccion, setMiReaccion] = useState<ReaccionTipo | null>(null);

  useEffect(() => {
    const key = `reacciones-${noticiaId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        setReacciones(JSON.parse(stored));
      } catch {
        // ignore
      }
    }
    const miReacKey = `mi-reaccion-${noticiaId}`;
    const miR = localStorage.getItem(miReacKey);
    if (miR === "like" || miR === "love") setMiReaccion(miR);
  }, [noticiaId]);

  const reaccionar = useCallback((tipo: ReaccionTipo) => {
    setReacciones((prev) => {
      const nueva = { ...prev };
      if (miReaccion === tipo) {
        // Quitar reacción
        nueva[tipo] = Math.max(0, nueva[tipo] - 1);
        setMiReaccion(null);
        localStorage.removeItem(`mi-reaccion-${noticiaId}`);
      } else {
        // Agregar nueva, quitar anterior si existe
        if (miReaccion) nueva[miReaccion] = Math.max(0, nueva[miReaccion] - 1);
        nueva[tipo] = nueva[tipo] + 1;
        setMiReaccion(tipo);
        localStorage.setItem(`mi-reaccion-${noticiaId}`, tipo);
      }
      localStorage.setItem(`reacciones-${noticiaId}`, JSON.stringify(nueva));
      return nueva;
    });
  }, [miReaccion, noticiaId]);

  return { reacciones, miReaccion, reaccionar };
}

// ══════════════════════════════════════════════════════════════
// FRASES COMPARTIBLES — cliente detecta párrafos destacables
// ══════════════════════════════════════════════════════════════
function FrasesCompartibles({ contenido, titulo }: { contenido: string; titulo: string }) {
  const [copiada, setCopiada] = useState<number | null>(null);

  const parrafos = limpiarAsteriscos(contenido)
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 50 && l.length < 180 && !l.startsWith("•") && !l.startsWith("#") && !l.startsWith("**"));

  // Tomar primeros 3 párrafos medianos
  const destacados = parrafos.slice(0, 3);

  if (destacados.length === 0) return null;

  const compartir = (texto: string, idx: number) => {
    const frase = `"${texto}" — ${titulo}`;
    navigator.clipboard.writeText(frase).then(() => {
      setCopiada(idx);
      setTimeout(() => setCopiada(null), 2000);
    });
  };

  return (
    <div className="my-12 pt-8 border-t-2 border-gris-borde">
      <h3 className="font-display text-2xl text-tinta mb-4 flex items-center gap-2">
        <Quote className="w-5 h-5 text-river-red" /> Frases destacadas
      </h3>
      <div className="space-y-3">
        {destacados.map((frase, i) => (
          <div
            key={i}
            className="group relative bg-gris-suave border-l-4 border-river-red p-4 hover:bg-white hover:shadow-md transition-all duration-200 cursor-pointer"
            onClick={() => compartir(frase, i)}
          >
            <p className="text-tinta italic text-base leading-relaxed pr-10">"{frase}"</p>
            <button
              className={cn(
                "absolute top-3 right-3 p-2 rounded-full transition-all",
                copiada === i
                  ? "bg-green-500 text-white"
                  : "bg-white text-gris-meta group-hover:bg-river-red group-hover:text-white"
              )}
              onClick={(e) => { e.stopPropagation(); compartir(frase, i); }}
              aria-label="Copiar frase"
            >
              {copiada === i ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            </button>
            {copiada === i && (
              <span className="absolute bottom-2 right-2 text-xs text-green-600 font-bold">
                ¡Copiado!
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-gris-meta mt-3 text-center">
        Tocá cualquier frase para copiarla y compartirla con tus amigos
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMENTARIOS
// ══════════════════════════════════════════════════════════════
function Comentarios({ noticiaId }: { noticiaId: number }) {
  const queryClient = useQueryClient();
  const [autor, setAutor] = useState("");
  const [contenido, setContenido] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["comentarios", noticiaId],
    queryFn: async (): Promise<Comentario[]> => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/noticias/${noticiaId}/comentarios`);
      if (!res.ok) throw new Error("Error al cargar comentarios");
      const json = (await res.json()) as { comentarios: Comentario[] };
      return json.comentarios;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/noticias/${noticiaId}/comentarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autor: autor.trim(), contenido: contenido.trim() }),
      });
      if (!res.ok) throw new Error("Error al publicar el comentario");
      return res.json();
    },
    onSuccess: () => {
      setContenido("");
      queryClient.invalidateQueries({ queryKey: ["comentarios", noticiaId] });
    },
  });

  const comentarios = data ?? [];

  return (
    <div className="mt-12 pt-10 border-t-2 border-gris-borde">
      <h2 className="font-display text-3xl text-tinta mb-6 flex items-center gap-2">
        <MessageCircle className="w-6 h-6 text-river-red" />
        Comentarios {comentarios.length > 0 && <span className="text-gris-meta text-2xl">({comentarios.length})</span>}
      </h2>

      {/* Formulario */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (contenido.trim() && !mutation.isPending) mutation.mutate();
        }}
        className="bg-white border-2 border-gris-borde p-6 mb-8"
      >
        <input
          type="text"
          value={autor}
          onChange={(e) => setAutor(e.target.value)}
          maxLength={60}
          placeholder="Tu nombre (opcional)"
          className="w-full bg-gris-suave border border-gris-borde px-4 py-3 text-sm text-tinta placeholder:text-gris-meta focus:outline-none focus:border-river-red transition-colors mb-3"
        />
        <textarea
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          maxLength={1000}
          rows={4}
          required
          placeholder="Dejá tu opinión sobre la nota..."
          className="w-full bg-gris-suave border border-gris-borde px-4 py-3 text-sm text-tinta placeholder:text-gris-meta focus:outline-none focus:border-river-red transition-colors resize-y"
        />
        {mutation.isError && (
          <p className="text-red-600 text-sm mt-2">No se pudo publicar el comentario. Probá de nuevo.</p>
        )}
        <button
          type="submit"
          disabled={mutation.isPending || !contenido.trim()}
          className="mt-4 inline-flex items-center gap-2 bg-river-red hover:bg-river-red-hover text-white font-bold py-3 px-6 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
        >
          <Send className="w-4 h-4" /> {mutation.isPending ? "Publicando..." : "Publicar comentario"}
        </button>
      </form>

      {/* Lista */}
      {isLoading ? (
        <p className="text-gris-meta text-sm">Cargando comentarios...</p>
      ) : comentarios.length === 0 ? (
        <p className="text-gris-meta text-sm">Sé el primero en comentar esta nota.</p>
      ) : (
        <div className="space-y-4">
          {comentarios.map((c) => (
            <div key={c.id} className="bg-white border border-gris-borde p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-river-red/10 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-river-red" />
                </div>
                <span className="font-bold text-sm text-tinta">{c.autor}</span>
                <span className="text-xs text-gris-meta font-mono">
                  {new Date(c.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              <p className="text-tinta text-sm whitespace-pre-wrap pl-10">{c.contenido}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// NOTICIAS RELACIONADAS
// ══════════════════════════════════════════════════════════════
function NoticiasRelacionadas({ current, categoria, lang, reviewNews }: { current: { id: number; title: string; excerpt: string }; categoria?: "river" | "seleccion"; lang: "es" | "he"; reviewNews?: NewsItem[] }) {
  const { data: allNews, isError, isLoading } = useNews(0, categoria, lang);
  const relacionadas = relatedNews({ ...current, id: String(current.id) }, reviewNews ?? allNews?.items ?? []);

  return (
    <div className="mt-12 pt-10 border-t-2 border-gris-borde">
      <h2 className="font-display text-3xl text-tinta mb-6">
        {lang === "he" ? "לקריאה הבאה" : "También te puede interesar"}
      </h2>
      {relacionadas.length === 0 && (
        <p role="status" className="text-gris-meta bg-white border border-gris-borde p-4" data-testid="status-no-related">
          {isError && !reviewNews
            ? lang === "he" ? "לא ניתן לטעון כתבות נוספות כרגע." : "No se pudieron cargar más noticias."
            : isLoading && !reviewNews
            ? lang === "he" ? "מחפשים כתבה קשורה..." : "Buscando otra lectura relacionada..."
            : lang === "he"
            ? "לא נמצאה כתבה קשורה על נושא אחר. אפשר לחזור לעמוד הראשי."
            : "No encontramos otra nota relevante sobre un hecho distinto. Volvé a la portada."}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {relacionadas.map((noticia) => (
          <Link key={noticia.id} href={`${lang === "he" ? "/he" : ""}/noticia/${noticia.id}`} data-testid={`link-next-reading-${noticia.id}`}>
            <div className="group cursor-pointer border border-gris-borde hover:border-river-red hover:shadow-lg transition-all duration-200">
              <div className="relative h-40 overflow-hidden">
                <img
                  src={noticia.imageUrl}
                  alt={noticia.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-4 bg-white">
                <p className="text-xs text-gris-meta mb-1 flex items-center gap-1 font-mono">
                  <Calendar className="w-3 h-3" />
                  {noticia.date}
                </p>
                <p className="text-sm font-bold text-tinta leading-snug group-hover:text-river-red transition-colors line-clamp-3">
                  {noticia.title}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════
export default function Noticia({ reviewArticle, reviewNews }: { reviewArticle?: NoticiaCompleta; reviewNews?: NewsItem[] } = {}) {
  const [location] = useLocation();
  const isHebrew = location.startsWith("/he/noticia/");
  const [match, params] = useRoute(isHebrew ? "/he/noticia/:id" : "/noticia/:id");
  const id = params?.id;
  const homeHref = isHebrew ? "/he" : "/";

  const { data: fetchedData, isLoading, isError } = useQuery({
    queryKey: ["noticia", id],
    queryFn: async (): Promise<NoticiaCompleta> => {
      const res = await fetch(`/api/noticias-publicadas/${id}`);
      if (!res.ok) throw new Error("Noticia no encontrada");
      const json = await res.json() as { noticia: NoticiaCompleta };
      return json.noticia;
    },
    enabled: !!id && !reviewArticle,
  });
  const data = reviewArticle ?? fetchedData;
  const hasPublishedHebrew = !!data?.hebreoPublicada && !!data.tituloHe?.trim() && (data.contenidoHe?.trim().length ?? 0) > 100;
  const unavailable = isHebrew && !!data && !hasPublishedHebrew && !reviewArticle;
  const title = isHebrew && hasPublishedHebrew ? data?.tituloHe ?? "" : data?.titulo ?? "";
  const content = isHebrew && hasPublishedHebrew ? data?.contenidoHe ?? "" : data?.contenido ?? "";
  const tags = isHebrew && hasPublishedHebrew ? data?.tagsHe ?? "" : data?.tags ?? "";

  // Progreso de lectura
  const [progreso, setProgreso] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const winScroll = document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (winScroll / height) * 100;
      setProgreso(scrolled);
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!data || unavailable || reviewArticle) return;
    const portada = data.imagenPortada;
    const resuelta = portada ? resolverPortada(portada) : "";
    const image = resuelta
      ? resuelta.startsWith("http")
        ? resuelta
        : `${window.location.origin}${resuelta}`
      : "https://riverplateisrael.com/opengraph.jpg";
    setPageMeta({
       title: `${limpiarAsteriscos(title)} | River Plate en Israel`,
       description: extraerDescripcion(limpiarAsteriscos(content)),
      image,
      url: window.location.href,
      type: "article",
    });
    return () => resetPageMeta();
  }, [data, title, content, unavailable, reviewArticle]);

  const { reacciones, miReaccion, reaccionar } = useReacciones(data?.id ?? 0);

  if (!match) return null;

  const imagenUrl = data?.imagenPortada
    ? resolverPortada(data.imagenPortada)
    : data
    ? reviewArticle ? "/images/hero-monumental.png" : IMAGENES[data.id % IMAGENES.length]
    : IMAGENES[0];

  return (
    <>
      {/* Barra de progreso de lectura */}
      <div className="reading-progress" style={{ transform: `scaleX(${progreso / 100})` }} />

      {isLoading && !reviewArticle && (
        <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-river-red border-t-transparent rounded-full animate-spin" />
            <p className="text-gris-meta font-bold font-display text-xl">CARGANDO NOTA...</p>
          </div>
        </div>
      )}

      {(isError || unavailable) && (
        <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8] pt-24">
          <div className="text-center space-y-4 max-w-md mx-auto px-4">
             <p className="text-4xl font-display text-tinta">{isHebrew ? "הכתבה אינה זמינה בעברית" : "NOTA NO ENCONTRADA"}</p>
             <p className="text-gris-meta">{isHebrew ? "תרגום הכתבה עדיין לא פורסם. אפשר לקרוא את המקור בספרדית." : "Esta nota no existe o fue eliminada."}</p>
             {isHebrew && data && <Link href={`/noticia/${data.id}`} className="block text-river-red underline" data-testid="link-spanish-original">לכתבה המקורית בספרדית</Link>}
             <Link href={homeHref}>
              <span className="inline-flex items-center gap-2 text-river-red font-bold hover:underline cursor-pointer uppercase tracking-wide">
                 <ArrowLeft className="w-4 h-4" /> {isHebrew ? "חזרה לעמוד הראשי" : "Volver a la portada"}
              </span>
            </Link>
          </div>
        </div>
      )}

      {data && !unavailable && (
        <motion.article
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="min-h-screen bg-[#FAFAF8] newspaper-texture"
          lang={isHebrew ? "he" : "es"}
          dir={isHebrew ? "rtl" : "ltr"}
        >
          {isHebrew && reviewArticle && <div className="bg-amber-100 text-amber-950 px-4 py-3 text-center text-sm font-bold" data-testid="status-review-draft">תצוגת בדיקה בלבד · טיוטה, לא תרגום שפורסם · תוכן המקור בספרדית</div>}
          {/* Hero editorial */}
          <div className="relative h-[60vh] min-h-[400px] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-tinta/90 via-tinta/40 to-transparent z-10" />
            <img
              src={imagenUrl}
              alt={limpiarAsteriscos(data.titulo)}
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 z-20 p-6 md:p-12 max-w-5xl mx-auto w-full">
               <Link href={homeHref} data-testid="link-article-home">
                <span className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm font-bold mb-4 cursor-pointer transition-colors uppercase tracking-wide">
                   <ArrowLeft className="w-4 h-4" /> {isHebrew ? "עמוד ראשי" : "Portada"}
                </span>
              </Link>
               <h1 dir={isHebrew && reviewArticle ? "ltr" : undefined} className="font-display text-4xl md:text-6xl text-white leading-tight mb-4">
                 {limpiarAsteriscos(title)}
              </h1>
              <div className="flex items-center gap-4 text-white/70 text-sm flex-wrap font-mono">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                   {isHebrew ? new Date(data.createdAt).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" }) : formatearFecha(data.createdAt)}
                </span>
                <span className="text-white/40">·</span>
                <span>River en Israel — Filial River Plate Israel Gaby "Tucu" Sajnin</span>
              </div>
            </div>
          </div>

          {/* Contenido principal */}
          <div className="max-w-4xl mx-auto px-6 py-12 pb-32">
            
            {/* Barra de acciones sticky */}
             <div className="sticky top-20 z-40 bg-white/95 backdrop-blur border-y-2 border-gris-borde py-4 mb-8 -mx-6 px-6 flex items-center justify-between gap-4 flex-wrap">
               {isHebrew && <span className="text-xs text-gris-meta">{reviewArticle ? "טיוטת בדיקה · מקור בספרדית" : "תרגום שפורסם"}</span>}
               {!reviewArticle && <div className="flex items-center gap-3">
                <button
                  onClick={() => reaccionar("like")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 border-2 transition-all font-bold text-sm",
                    miReaccion === "like"
                      ? "bg-river-red text-white border-river-red"
                      : "bg-white text-gris-meta border-gris-borde hover:border-river-red hover:text-river-red"
                  )}
                   aria-label={isHebrew ? "אהבתי" : "Me gusta"}
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span>{reacciones.like}</span>
                </button>
                <button
                  onClick={() => reaccionar("love")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 border-2 transition-all font-bold text-sm",
                    miReaccion === "love"
                      ? "bg-river-red text-white border-river-red"
                      : "bg-white text-gris-meta border-gris-borde hover:border-river-red hover:text-river-red"
                  )}
                   aria-label={isHebrew ? "אהבתי מאוד" : "Me encanta"}
                >
                  <Heart className="w-4 h-4" />
                  <span>{reacciones.love}</span>
                </button>
               </div>}
               {!reviewArticle && <ShareButton titulo={limpiarAsteriscos(title)} id={data.id} lang={isHebrew ? "he" : "es"} />}
            </div>

            {data.imagenInstagram && (
              <figure className="mb-10">
                <img
                  src={data.imagenInstagram.startsWith("https://") ? data.imagenInstagram : `/api/storage${data.imagenInstagram}`}
                   alt={`Ilustración editorial: ${limpiarAsteriscos(title)}`}
                  className="w-full max-w-lg mx-auto h-auto rounded-lg"
                  loading="lazy"
                />
                <figcaption className="text-center text-xs text-gray-500 mt-2">Ilustración editorial · River Plate Israel</figcaption>
              </figure>
            )}
            {/* Cuerpo de la nota */}
             <div dir={isHebrew && reviewArticle ? "ltr" : undefined} className="prose-custom space-y-6 text-start">
               {renderContenido(content)}
            </div>

            {/* Frases compartibles */}
             {!isHebrew && <FrasesCompartibles contenido={data.contenido} titulo={limpiarAsteriscos(data.titulo)} />}

            {/* Tags */}
             {tags && (
              <div className="mt-10 pt-6 border-t border-gris-borde">
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="w-4 h-4 text-river-red flex-shrink-0" />
                   {tags.split(/\s+/).filter(t => t.startsWith("#")).map((tag, i) => (
                    <span key={i} className="text-sm font-bold text-river-red bg-red-50 px-3 py-1 border border-river-red/20">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Comentarios */}
             {!isHebrew && <Comentarios noticiaId={data.id} />}
             {isHebrew && <p className="mt-10 text-sm text-gris-meta" data-testid="status-comments-language">תגובות זמינות במהדורה הספרדית בלבד. <Link href={`/noticia/${data.id}`} className="underline text-river-red">לכתבה בספרדית</Link></p>}

            {/* Noticias relacionadas */}
             <NoticiasRelacionadas current={{ id: data.id, title, excerpt: content.slice(0, 650) }} categoria={data.categoria} lang={isHebrew ? "he" : "es"} reviewNews={reviewNews} />

            {/* CTA Filial */}
             {!isHebrew && <div className="mt-12 bg-tinta border-4 border-river-red p-8 text-center text-white">
              <p className="font-display text-3xl mb-2">SUMATE A LA FILIAL</p>
              <p className="text-white/80 mb-6">Viví River desde Israel con la comunidad de Ramat Gan. Partidos, eventos y más.</p>
              <a
                href="https://chat.whatsapp.com/LGMvmF1bKjJ2PlZ1GqCfo0"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-river-red hover:bg-river-red-hover text-white font-bold px-8 py-3 transition-colors uppercase tracking-wide"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Canal de WhatsApp
              </a>
             </div>}

            {/* Volver */}
            <div className="mt-10 text-center">
               <Link href={homeHref}>
                <span className="inline-flex items-center gap-2 text-gris-meta hover:text-river-red font-bold cursor-pointer transition-colors uppercase tracking-wide text-sm">
                   <ArrowLeft className="w-4 h-4" /> {isHebrew ? "חזרה לעמוד הראשי" : "Volver a la portada"}
                </span>
              </Link>
            </div>
          </div>
           {!isHebrew && <FloatingWhatsAppShare titulo={limpiarAsteriscos(data.titulo)} id={data.id} />}
        </motion.article>
      )}
    </>
  );
}
