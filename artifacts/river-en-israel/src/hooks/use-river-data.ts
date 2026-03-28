// Datos mock para el sitio de hinchas
import { useQuery, useMutation } from "@tanstack/react-query";

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

// --- Datos Mock ---

const MOCK_NEWS: NewsItem[] = [
  {
    id: "1",
    title: "¡Banda Monumental! River aplasta a su rival en el cierre del torneo",
    excerpt: "Con una actuación estelar de Miguel Borja, el Millonario demostró por qué es el más grande de Argentina.",
    date: "12 Oct 2024",
    imageUrl: "https://images.unsplash.com/photo-1518605368461-1e122c4cdce0?q=80&w=2070&auto=format&fit=crop",
    category: "Primer Equipo"
  },
  {
    id: "2",
    title: "Nueva reunión de la Filial Ramat Gan programada para el Superclásico",
    excerpt: "Nos juntamos este domingo en el bar de siempre para vivir el partido más importante del año. ¡No faltes!",
    date: "10 Oct 2024",
    imageUrl: "https://images.unsplash.com/photo-1517466787929-bc90951d0974?q=80&w=2069&auto=format&fit=crop",
    category: "Filial Israel"
  },
  {
    id: "3",
    title: "El Monumental sigue batiendo récords de asistencia",
    excerpt: "Más de 85,000 almas tiñeron de rojo y blanco las tribunas en otra noche mágica de Copa Libertadores.",
    date: "05 Oct 2024",
    imageUrl: "https://images.unsplash.com/photo-1556056504-5c7696c4c28d?q=80&w=2076&auto=format&fit=crop",
    category: "Institucional"
  }
];

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

// --- Hooks ---

export function useNews() {
  return useQuery({
    queryKey: ['news'],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      return MOCK_NEWS;
    }
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
