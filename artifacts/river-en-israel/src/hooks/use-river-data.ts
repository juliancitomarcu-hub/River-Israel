// נתוני Mock לאתר האוהדים
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

// --- נתוני Mock ---

const MOCK_NEWS: NewsItem[] = [
  {
    id: "1",
    title: "ריבר מנצחת בגדול! הבנדה המונומנטאלית מדהימה שוב",
    excerpt: "עם הופעה מבריקה של מיגל בורחה, המיליונרים הוכיחו שוב מדוע הם הקלוב הגדול ביותר בארגנטינה.",
    date: "12 אוק 2024",
    imageUrl: "https://images.unsplash.com/photo-1518605368461-1e122c4cdce0?q=80&w=2070&auto=format&fit=crop",
    category: "הקבוצה הראשונה"
  },
  {
    id: "2",
    title: "מפגש הסניף ברמת גן - הסופרקלאסיקו מגיע!",
    excerpt: "נתאסף ביום ראשון בבר הרגיל לצפות במשחק החשוב ביותר של השנה. אל תפספסו!",
    date: "10 אוק 2024",
    imageUrl: "https://images.unsplash.com/photo-1517466787929-bc90951d0974?q=80&w=2069&auto=format&fit=crop",
    category: "סניף ישראל"
  },
  {
    id: "3",
    title: "המונומנטאל שובר שיאי נוכחות שוב ושוב",
    excerpt: "יותר מ-85,000 אוהדים צבעו את הטריבונות באדום ולבן בלילה קסום נוסף של קופה ליברטדורס.",
    date: "05 אוק 2024",
    imageUrl: "https://images.unsplash.com/photo-1556056504-5c7696c4c28d?q=80&w=2076&auto=format&fit=crop",
    category: "מוסדי"
  }
];

const MOCK_MATCHES: MatchResult[] = [
  { id: "m1", competition: "ליגה פרופסיונל", date: "10/10/2024", homeTeam: "ריבר פלייט", awayTeam: "אינדפנדיינטה", homeScore: 3, awayScore: 0, status: "FINISHED", isRiverHome: true },
  { id: "m2", competition: "קופה ליברטדורס", date: "03/10/2024", homeTeam: "נסיונל (אורו)", awayTeam: "ריבר פלייט", homeScore: 1, awayScore: 2, status: "FINISHED", isRiverHome: false },
  { id: "m3", competition: "ליגה פרופסיונל", date: "15/10/2024", homeTeam: "בוקה ג'וניורס", awayTeam: "ריבר פלייט", homeScore: null, awayScore: null, status: "UPCOMING", isRiverHome: false },
];

const MOCK_TIMELINE: TimelineEvent[] = [
  { year: "1901", title: "הקמת הקלוב", description: "ב-25 במאי 1901 נוסד קלוב אטלטיקו ריבר פלייט בשכונת לה בוקה, לאחר מיזוג קלובי סנטה רוסה ולה רוסאלס." },
  { year: "1938", title: "נולד המונומנטאל", description: "חנוכת אצטדיון אנטוניו ווספוצ'י ליברטי, הידוע כיום כ'הכי מונומנטאלי', בית הנצח של המיליונרים." },
  { year: "1986", title: "קופה ליברטדורס הראשונה", description: "עם הקבוצה המפוארת של 'במבינו' וויירה, ריבר כובשת את אמריקה ואת העולם לאחר ניצחון על סטאואה בוקרשט בטוקיו." },
  { year: "1996", title: "הליברטדורס השנייה עם ראמון", description: "קבוצה עמוסה בכוכבים בהובלת אנצו פרנסקולי מרימה את הליברטדורס השנייה במונומנטאל מלא עד אפס מקום." },
  { year: "2015", title: "השלישית עם מוניקו", description: "תחת הגשם, ריבר מנצחת את טיגרס ומרסלו גאיארדו מתחיל לבנות את אגדתו הזהובה כמאמן." },
  { year: "2018", title: "התהילה הנצחית במדריד", description: "ב-9 בדצמבר 2018, ריבר פלייט מנצחת את יריבה הנצחי 3-1 בסנטיאגו ברנבאו, וזוכה בליברטדורס החשובה ביותר בהיסטוריה." },
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
      console.log("טופס הסניף נשלח:", data);
      return { success: true, message: "!ההודעה נשלחה בהצלחה! ניצור קשר בקרוב" };
    }
  });
}
