import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, useLocation } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import Home from "../../../../../../.local/reviews/river-integration/source/artifacts/river-en-israel/src/pages/Home";
import Noticia from "../../../../../../.local/reviews/river-integration/source/artifacts/river-en-israel/src/pages/Noticia";
import { resolverPortada, limpiarAsteriscos, type NewsItem } from "../../../../../../.local/reviews/river-integration/source/artifacts/river-en-israel/src/hooks/use-river-data";
import "./_group.css";

type Article = {
  id: number; titulo: string; contenido: string; tags: string; fuente: string;
  textoOriginal: string; createdAt: string; imagenPortada?: string;
  imagenInstagram?: string; categoria?: "river" | "seleccion";
  tituloHe?: string; contenidoHe?: string; tagsHe?: string; hebreoPublicada?: boolean;
};

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const locationHook = memoryLocation({ path: "/he" });

function ReviewFlow() {
  const [location, navigate] = useLocation();
  const [articles, setArticles] = useState<Article[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/noticias-publicadas?categoria=river&page=0&limit=6", { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(`GET noticias-publicadas: ${response.status}`);
        const payload = await response.json() as { noticias: Article[] };
        if (!payload.noticias?.length) throw new Error("La API pública no devolvió noticias reales");
        setArticles(payload.noticias);
      })
      .catch(cause => { if (!controller.signal.aborted) setError(String(cause)); });
    return () => controller.abort();
  }, []);

  const news: NewsItem[] = articles.map(article => ({
    id: String(article.id),
    title: limpiarAsteriscos(article.titulo),
    excerpt: limpiarAsteriscos(article.contenido.split("\n").find(line => line.trim().length > 20) ?? article.contenido).slice(0, 160),
    date: new Date(article.createdAt).toLocaleDateString("es-AR"),
    imageUrl: article.imagenPortada ? resolverPortada(article.imagenPortada) : "/images/hero-monumental.png",
    category: "Actualidad",
  }));
  const selected = articles.find(article => String(article.id) === location.split("/").at(-1));

  return (
    <div className="river-review">
      <header className="sticky top-0 z-50 border-b-2 border-tinta bg-white px-4 py-3 flex items-center justify-between gap-2">
        <button type="button" onClick={() => navigate("/he")} data-testid="button-review-home" className="font-display text-xl text-tinta">ריבר בישראל</button>
        <span className="text-[11px] font-bold text-river-red">סקירת טיוטה · מקור בספרדית</span>
      </header>
      {error && <p role="alert" className="p-6 text-red-700">לא ניתן לטעון תוכן אמיתי מה־API הציבורי: {error}</p>}
      {!error && !articles.length && <p role="status" className="p-6">טוענים כתבות מקור מה־API הציבורי...</p>}
      {articles.length > 0 && (location === "/he"
        ? <Home reviewNews={news} />
        : selected
        ? <Noticia key={selected.id} reviewArticle={selected} reviewNews={news} />
        : <div className="p-6" dir="rtl">הכתבה אינה ברשימת הבדיקה. <button type="button" onClick={() => navigate("/he")} className="underline">חזרה לעמוד הראשי</button></div>)}
    </div>
  );
}

export function Review() {
  return <QueryClientProvider client={queryClient}><Router hook={locationHook.hook}><ReviewFlow /></Router></QueryClientProvider>;
}