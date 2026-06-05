import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Calendar, ArrowLeft, Tag, MessageCircle, Send, User } from "lucide-react";
import ShareButton from "@/components/ShareButton";
import { useNews, type NewsItem } from "@/hooks/use-river-data";

interface Comentario {
  id: number;
  autor: string;
  contenido: string;
  createdAt: string;
}

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
    <div className="mt-12 pt-10 border-t border-gray-100">
      <h2 className="text-xl font-display font-bold text-river-black mb-6 uppercase tracking-wide flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-river-red" />
        Comentarios {comentarios.length > 0 && <span className="text-gray-400">({comentarios.length})</span>}
      </h2>

      {/* Formulario */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (contenido.trim() && !mutation.isPending) mutation.mutate();
        }}
        className="bg-gray-50 border border-gray-100 rounded-2xl p-5 mb-8"
      >
        <input
          type="text"
          value={autor}
          onChange={(e) => setAutor(e.target.value)}
          maxLength={60}
          placeholder="Tu nombre (opcional)"
          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-river-black placeholder:text-gray-400 focus:outline-none focus:border-river-red transition-colors mb-3"
        />
        <textarea
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          maxLength={1000}
          rows={3}
          required
          placeholder="Escribí tu comentario..."
          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-river-black placeholder:text-gray-400 focus:outline-none focus:border-river-red transition-colors resize-y"
        />
        {mutation.isError && (
          <p className="text-red-500 text-sm mt-2">No se pudo publicar el comentario. Probá de nuevo.</p>
        )}
        <button
          type="submit"
          disabled={mutation.isPending || !contenido.trim()}
          className="mt-3 inline-flex items-center gap-2 bg-river-red hover:bg-river-red-hover text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" /> {mutation.isPending ? "Publicando..." : "Publicar comentario"}
        </button>
      </form>

      {/* Lista */}
      {isLoading ? (
        <p className="text-gray-400 text-sm">Cargando comentarios...</p>
      ) : comentarios.length === 0 ? (
        <p className="text-gray-400 text-sm">Sé el primero en comentar.</p>
      ) : (
        <div className="space-y-4">
          {comentarios.map((c) => (
            <div key={c.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-full bg-river-red/10 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-river-red" />
                </div>
                <span className="font-bold text-sm text-river-black">{c.autor}</span>
                <span className="text-xs text-gray-400">
                  {new Date(c.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              <p className="text-gray-700 text-sm whitespace-pre-wrap pl-9">{c.contenido}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface NoticiaCompleta {
  id: number;
  titulo: string;
  contenido: string;
  tags: string;
  fuente: string;
  textoOriginal: string;
  imagenPortada?: string;
  createdAt: string;
  categoria?: "river" | "seleccion";
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

function NoticiasRelacionadas({ currentId, categoria }: { currentId: number; categoria?: "river" | "seleccion" }) {
  const { data: allNews } = useNews(0, categoria);

  const relacionadas: NewsItem[] = (allNews?.items ?? [])
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

            {/* Comentarios */}
            <Comentarios noticiaId={data.id} />

            {/* Noticias relacionadas */}
            <NoticiasRelacionadas currentId={data.id} categoria={data.categoria} />

            {/* CTA Filial */}
            <div className="mt-10 bg-river-black rounded-2xl p-8 text-center text-white">
              <p className="text-2xl font-display font-bold mb-2">¡Sumate a la Filial!</p>
              <p className="text-white/70 mb-6">Viví River desde Israel con la comunidad de Ramat Gan. Partidos, eventos y más.</p>
              <a
                href="https://whatsapp.com/channel/0029VbCkS5VHrDZiSDf9g01s"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-river-red hover:bg-river-red/90 text-white font-bold px-8 py-3 rounded-full transition-colors"
              >
                Unite al canal de WhatsApp
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
