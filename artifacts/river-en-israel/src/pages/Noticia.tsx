import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Calendar, ArrowLeft, Tag } from "lucide-react";
import ShareButton from "@/components/ShareButton";
import { useNews, type NewsItem } from "@/hooks/use-river-data";

interface NoticiaCompleta {
  id: number;
  titulo: string;
  contenido: string;
  tags: string;
  fuente: string;
  textoOriginal: string;
  imagenPortada?: string;
  createdAt: string;
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

function formatearFechaCorta(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function renderContenido(texto: string) {
  return texto.split("\n").map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} className="h-4" />;

    if (trimmed.startsWith("•")) {
      return (
        <li key={i} className="text-gray-700 text-lg leading-relaxed ml-4 list-disc marker:text-river-red">
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
      <p key={i} className="text-gray-700 text-lg leading-relaxed">
        {trimmed}
      </p>
    );
  });
}

function NoticiasRelacionadas({ currentId }: { currentId: number }) {
  const { data: allNews } = useNews();

  const relacionadas: NewsItem[] = (allNews ?? [])
    .filter((n) => n.id !== String(currentId) && !n.id.startsWith("mock"))
    .slice(0, 3);

  if (relacionadas.length === 0) return null;

  return (
    <div className="mt-12 pt-10 border-t border-gray-100">
      <h2 className="text-xl font-display font-bold text-river-black mb-6 uppercase tracking-wide">
        También te puede interesar
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {relacionadas.map((noticia) => (
          <Link key={noticia.id} href={`/noticia/${noticia.id}`}>
            <div className="group cursor-pointer rounded-xl overflow-hidden border border-gray-100 hover:border-river-red/30 hover:shadow-md transition-all duration-200">
              <div className="relative h-36 overflow-hidden">
                <img
                  src={noticia.imageUrl}
                  alt={noticia.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <span className="absolute top-2 left-2 bg-river-red text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                  {noticia.category}
                </span>
              </div>
              <div className="p-3">
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {noticia.date}
                </p>
                <p className="text-sm font-bold text-river-black leading-snug group-hover:text-river-red transition-colors line-clamp-2">
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

export default function Noticia() {
  const [match, params] = useRoute("/noticia/:id");
  const id = params?.id;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["noticia", id],
    queryFn: async (): Promise<NoticiaCompleta> => {
      const res = await fetch(`/api/noticias-publicadas/${id}`);
      if (!res.ok) throw new Error("Noticia no encontrada");
      const json = await res.json() as { noticia: NoticiaCompleta };
      return json.noticia;
    },
    enabled: !!id,
  });

  if (!match) return null;

  const imagenUrl = data?.imagenPortada
    ? `/api/storage${data.imagenPortada}`
    : data
    ? IMAGENES[data.id % IMAGENES.length]
    : IMAGENES[0];

  return (
    <>
      {isLoading && (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-river-red border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 font-medium">Cargando nota...</p>
          </div>
        </div>
      )}

      {isError && (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center space-y-4">
            <p className="text-2xl font-display font-bold text-river-black">Nota no encontrada</p>
            <p className="text-gray-500">Esta nota no existe o fue eliminada.</p>
            <Link href="/#actualidad">
              <span className="inline-flex items-center gap-2 text-river-red font-bold hover:underline cursor-pointer">
                <ArrowLeft className="w-4 h-4" /> Volver a Actualidad
              </span>
            </Link>
          </div>
        </div>
      )}

      {data && (
        <motion.article
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="min-h-screen bg-white"
        >
          {/* Hero de la nota */}
          <div className="relative h-[50vh] min-h-[320px] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent z-10" />
            <img
              src={imagenUrl}
              alt={data.titulo}
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 z-20 p-6 md:p-12 max-w-4xl mx-auto w-full">
              <Link href="/#actualidad">
                <span className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium mb-4 cursor-pointer transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Volver a Actualidad
                </span>
              </Link>
              <div className="mb-3">
                <span className="bg-river-red text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                  {data.fuente || "Actualidad"}
                </span>
              </div>
              <h1 className="text-3xl md:text-5xl font-display font-bold text-white leading-tight">
                {data.titulo}
              </h1>
              <div className="flex items-center gap-4 mt-4 text-white/60 text-sm flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {formatearFecha(data.createdAt)}
                </span>
                <span className="text-white/40">·</span>
                <span>River en Israel — Filial Ramat Gan</span>
                <ShareButton
                  titulo={data.titulo}
                  id={data.id}
                  className="ml-auto"
                />
              </div>
            </div>
          </div>

          {/* Contenido */}
          <div className="max-w-3xl mx-auto px-6 py-12">
            <div className="prose-custom space-y-4">
              {renderContenido(data.contenido)}
            </div>

            {/* Tags */}
            {data.tags && (
              <div className="mt-10 pt-8 border-t border-gray-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="w-4 h-4 text-river-red flex-shrink-0" />
                  {data.tags.split(/\s+/).filter(t => t.startsWith("#")).map((tag, i) => (
                    <span key={i} className="text-sm font-semibold text-river-red bg-red-50 px-3 py-1 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Noticias relacionadas */}
            <NoticiasRelacionadas currentId={data.id} />

            {/* CTA Filial */}
            <div className="mt-10 bg-river-black rounded-2xl p-8 text-center text-white">
              <p className="text-2xl font-display font-bold mb-2">¡Sumate a la Filial!</p>
              <p className="text-white/70 mb-6">Viví River desde Israel con la comunidad de Ramat Gan. Partidos, eventos y más.</p>
              <a
                href="https://chat.whatsapp.com/CVctijXuwxmEJMpU4jmFMv?mode=gi_t"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-river-red hover:bg-river-red/90 text-white font-bold px-8 py-3 rounded-full transition-colors"
              >
                Unirme al grupo de WhatsApp
              </a>
            </div>

            {/* Volver */}
            <div className="mt-8 text-center">
              <Link href="/#actualidad">
                <span className="inline-flex items-center gap-2 text-gray-500 hover:text-river-red font-medium cursor-pointer transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Ver más noticias
                </span>
              </Link>
            </div>
          </div>
        </motion.article>
      )}
    </>
  );
}
