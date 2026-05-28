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
  horaIsrael: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: 'FINISHED' | 'UPCOMING' | 'LIVE';
  isRiverHome: boolean;
  resultado: string | null;
  estadio?: string;
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
  imagenPortada?: string;
  createdAt: string;
}

const MOCK_MATCHES: MatchResult[] = [
  { id: "m1", competition: "Liga Profesional", date: "10/10/2024", homeTeam: "River Plate", awayTeam: "Independiente", homeScore: 3, awayScore: 0, status: "FINISHED", isRiverHome: true, horaIsrael: "", resultado: null },
  { id: "m2", competition: "Copa Libertadores", date: "03/10/2024", homeTeam: "Nacional (URU)", awayTeam: "River Plate", homeScore: 1, awayScore: 2, status: "FINISHED", isRiverHome: false, horaIsrael: "", resultado: null },
  { id: "m3", competition: "Liga Profesional", date: "15/10/2024", homeTeam: "Boca Juniors", awayTeam: "River Plate", homeScore: null, awayScore: null, status: "UPCOMING", isRiverHome: false, horaIsrael: "", resultado: null },
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

  const imageUrl = n.imagenPortada
    ? `/api/storage${n.imagenPortada}`
    : IMAGENES[n.id % IMAGENES.length];

  return {
    id: String(n.id),
    title: n.titulo,
    excerpt: primerParrafo.slice(0, 160),
    date: formatearFecha(n.createdAt),
    imageUrl,
    category: categoria,
  };
}

interface NewsPage {
  items: NewsItem[];
  total: number;
  totalPages: number;
  page: number;
}

export function useNews(page = 0) {
  return useQuery({
    queryKey: ["noticias-publicadas", page],
    queryFn: async (): Promise<NewsPage> => {
      const res = await fetch(`/api/noticias-publicadas?page=${page}&limit=6`);
      if (!res.ok) return { items: MOCK_NEWS_FALLBACK, total: 1, totalPages: 1, page: 0 };
      const data = await res.json() as { noticias: NoticiaPublicada[]; total: number; totalPages: number; page: number };
      if (!data.noticias || data.noticias.length === 0) return { items: MOCK_NEWS_FALLBACK, total: 1, totalPages: 1, page: 0 };
      return {
        items: data.noticias.map(noticiaANewsItem),
        total: data.total ?? data.noticias.length,
        totalPages: data.totalPages ?? 1,
        page: data.page ?? 0,
      };
    },
    staleTime: 30_000,
  });
}

interface PartidoAPI {
  id: string;
  competicion: string;
  fecha: string;
  horaIsrael: string;
  equipoLocal: string;
  equipoVisitante: string;
  golesLocal: number | null;
  golesVisitante: number | null;
  estado: "FINALIZADO" | "PROXIMO" | "EN_CURSO";
  esLocalRiver: boolean;
  resultado: string | null;
  estadio?: string;
}

export function useMatches() {
  return useQuery({
    queryKey: ["partidos-river-v2"],
    queryFn: async (): Promise<MatchResult[]> => {
      const res = await fetch("/api/partidos-river");
      if (!res.ok) return MOCK_MATCHES;
      const json = await res.json() as { partidos: PartidoAPI[] };
      if (!json.partidos?.length) return MOCK_MATCHES;

      return json.partidos.map((p): MatchResult => ({
        id: p.id,
        competition: p.competicion,
        date: p.fecha,
        horaIsrael: p.horaIsrael,
        homeTeam: p.equipoLocal,
        awayTeam: p.equipoVisitante,
        homeScore: p.golesLocal,
        awayScore: p.golesVisitante,
        status: p.estado === "FINALIZADO" ? "FINISHED" : p.estado === "EN_CURSO" ? "LIVE" : "UPCOMING",
        isRiverHome: p.esLocalRiver,
        resultado: p.resultado,
        estadio: p.estadio,
      }));
    },
    staleTime: 60_000,
    refetchOnMount: true,
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
