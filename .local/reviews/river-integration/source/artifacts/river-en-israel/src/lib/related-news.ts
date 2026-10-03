import type { NewsItem } from "@/hooks/use-river-data";

const COMMON = new Set(
  "river plate israel noticia noticias club futbol fútbol equipo partido partidos copa liga temporada hoy ayer mañana ante con para desde sobre entre tras del las los una uno unos unas este esta estos estas por que fue son sus más como pero hubo será tiene nuevo nueva también después frente victoria derrota empate goleada triunfo selección argentina".split(" ")
);

function terms(value: string): Set<string> {
  return new Set(
    value.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .match(/[\p{L}\p{N}]{3,}/gu)
      ?.filter(word => !COMMON.has(word) && !/^\d{1,2}$/.test(word)) ?? []
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  return [...a].filter(word => b.has(word)).length;
}

/** Conservative editorial suggestions: topical overlap required, near-identical facts excluded. */
export function relatedNews(current: { id: string; title: string; excerpt: string }, candidates: NewsItem[]): NewsItem[] {
  const currentTitle = terms(current.title);
  const currentTerms = terms(`${current.title} ${current.excerpt}`);
  const selected: NewsItem[] = [];
  return candidates
    .filter(item => item.id !== current.id && !item.id.startsWith("mock"))
    .map(item => {
      const title = terms(item.title);
      const all = terms(`${item.title} ${item.excerpt}`);
      const shared = overlap(currentTerms, all);
      const titleSimilarity = overlap(currentTitle, title) / Math.max(1, Math.min(currentTitle.size, title.size));
      return { item, shared, titleSimilarity, title, all };
    })
    .filter(entry => entry.shared >= 2 && entry.titleSimilarity < 0.55)
    .sort((a, b) => b.shared - a.shared)
    .filter(entry => {
      if (selected.some(item => {
        const other = terms(item.title);
        return overlap(entry.title, other) / Math.max(1, Math.min(entry.title.size, other.size)) >= 0.55;
      })) return false;
      selected.push(entry.item);
      return selected.length <= 3;
    })
    .slice(0, 3)
    .map(entry => entry.item);
}