import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  imageUrl: string;
  category: string;
}

export interface MatchResult {
  id: string;
  competition: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: 'FINISHED' | 'UPCOMING';
  isRiverHome: boolean;
}

export interface TimelineEvent {
  year: string;
  title: string;
  description: string;
}

interface NoticiaPublicada {
  id: number;
  titulo: string;
  contenido: string;
  tags: string;
  fuente: string;
  createdAt: string;
}

const MOCK_MATCHES: MatchResult[] = [
  { id: "m1", competition: "Liga Profesional", date: "10/10/2024", homeTeam: "River Plate", awayTeam: "Independiente", homeScore: 3, awayScore: 0, status: "FINISHED", isRiverHome: true },
  { id: "m2", competition: "Copa Libertadores", date: "03/10/2024", homeTeam: "Nacional (URU)", awayTeam: "River Plate", homeScore: 1, awayScore: 2, status: "FINISHED", isRiverHome: false },
  { id: "m3", competition: "Liga Profesional", date: "15/10/2024", homeTeam: "Boca Juniors", awayTeam: "River Plate", homeScore: null, awayScore: null, status: "UPCOMING", isRiverHome: false },
];

const MOCK_TIMELINE: TimelineEvent[] = [
  { year: "1901", title: "Fundación", description: "El 25 de mayo de 1901 nace el Club Atlético River Plate en el barrio de La Boca, tras la fusión de los clubes Santa Rosa y La Rosales." },
  { year: "1938", title: "Nace El Monumental", description: "Inauguración del Estadio Antonio Vespucio Liberti, hoy conocido como el Más Monumental, la casa eterna del Millonario." },
  { year: "1986", title: "Primera Copa Libertadores", description: "Con el glorioso equipo del 'Bambino' Veira, River conquista América y luego el mundo al vencer al Steaua Bucarest en Tokio." },
  { year: "1996", title: "La Segunda con Ramón", description: "Un equipo plagado de estrellas liderado por Enzo Francescoli levanta la segunda Libertadores en un Monumental repleto." },
  { year: "2015", title: "La Tercera con el Muñeco", description: "Bajo la lluvia, River golea a Tigres y Marcelo Gallardo comienza a forjar su leyenda dorada como DT." },
  { year: "2018", title: "La Gloria Eterna en Madrid", description: "El 9 de diciembre de 2018, River Plate vence a su eterno rival 3-1 en el Santiago Bernabéu, conquistando la Libertadores más importante de la historia." },
];

const MOCK_NEWS_FALLBACK: NewsItem[] = [
  {
    id: "mock-1",
    title: "¡Bienvenidos a River en Israel!",
    excerpt: "Publicá tu primera noticia desde el Redactor IA y aparecerá acá automáticamente.",
    date: new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }),
    imageUrl: "https://images.unsplash.com/photo-1518605368461-1e122c4cdce0?q=80&w=2070&auto=format&fit=crop",
    category: "Filial Israel"
  },
];

function formatearFecha(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function noticiaANewsItem(n: NoticiaPublicada): NewsItem {
  const primerParrafo = n.contenido
    .split("\n")
    .find((l) => l.trim().length > 20 && !l.startsWith("**") && !l.startsWith("•")) ?? n.contenido.slice(0, 120);

  const categorias: Record<string, string> = {
    "tyc sports": "TyC Sports",
    "olé": "Olé",
    "ole": "Olé",
  };
  const categoria = categorias[n.fuente.toLowerCase()] ?? "Actualidad";

  const IMAGENES = [
    "https://images.unsplash.com/photo-1518605368461-1e122c4cdce0?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1556056504-5c7696c4c28d?q=80&w=2076&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1517466787929-bc90951d0974?q=80&w=2069&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=2070&auto=format&fit=crop",
  ];

  return {
    id: String(n.id),
    title: n.titulo,
    excerpt: primerParrafo.slice(0, 160),
    date: formatearFecha(n.createdAt),
    imageUrl: IMAGENES[n.id % IMAGENES.length],
    category: categoria,
  };
}

export function useNews() {
  return useQuery({
    queryKey: ["noticias-publicadas"],
    queryFn: async (): Promise<NewsItem[]> => {
      const res = await fetch("/api/noticias-publicadas");
      if (!res.ok) return MOCK_NEWS_FALLBACK;
      const data = await res.json() as { noticias: NoticiaPublicada[] };
      if (!data.noticias || data.noticias.length === 0) return MOCK_NEWS_FALLBACK;
      return data.noticias.map(noticiaANewsItem);
    },
    staleTime: 30_000,
  });
}

export function useMatches() {
  return useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 400));
      return MOCK_MATCHES;
    }
  });
}

export function useHistoryTimeline() {
  return useQuery({
    queryKey: ['history'],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      return MOCK_TIMELINE;
    }
  });
}

export function useSubmitContact() {
  return useMutation({
    mutationFn: async (data: { name: string; email: string; phone: string; message: string }) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log("Formulario de filial enviado:", data);
      return { success: true, message: "¡Mensaje enviado con éxito! Nos pondremos en contacto pronto." };
    }
  });
}
