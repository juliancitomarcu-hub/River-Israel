import { useCallback, useEffect, useState } from "react";

interface Publicacion {
  noticia_id: number; titulo: string; estado: string; caption: string | null;
  imagen_url: string | null; error: string | null; created_at: string;
}
interface Estado { configurada: boolean; desde: string | null; publicaciones: Publicacion[] }
const nombres: Record<string, string> = { pendiente: "Preparando post", preparada: "Procesando imagen", publicando: "Confirmando publicación", publicada: "Publicada en Instagram", fallida: "No se pudo publicar", revision: "Requiere revisión en Meta", cancelada: "Cancelada" };

export default function InstagramPublicaciones() {
  const [data, setData] = useState<Estado | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const cargar = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/instagram/publicaciones", { credentials: "include", signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "No se pudo consultar Instagram");
      setData(body); setError("");
    } catch (err) { if (!signal?.aborted) setError(err instanceof Error ? err.message : "No se pudo consultar Instagram"); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void cargar(controller.signal);
    const timer = setInterval(() => void cargar(controller.signal), 30_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [cargar]);
  async function reintentar(id: number) {
    setBusy(true);
    try {
      const response = await fetch(`/api/instagram/publicaciones/${id}/reintentar`, { method: "POST", credentials: "include" });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error); }
      await cargar();
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo reintentar"); }
    finally { setBusy(false); }
  }
  return <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3" aria-label="Publicaciones en Instagram">
    <div className="flex justify-between gap-3"><h3 className="font-bold">Instagram · @riverplateisrael</h3>
      <button type="button" className="text-sm underline" onClick={() => void cargar()}>Actualizar</button></div>
    <p className="text-sm text-gray-600">{!data ? "Consultando estado…" : data.configurada
      ? "Las nuevas notas de River se publican automáticamente con una placa y texto adaptado."
      : "La publicación automática está desactivada o falta configurar la cuenta de Instagram."}</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {data?.publicaciones.length === 0 && <p className="text-sm text-gray-500">Todavía no hay entregas a Instagram.</p>}
    {data?.publicaciones.map(post => <details key={post.noticia_id} className="border-t pt-3">
      <summary className="cursor-pointer text-sm"><strong>{post.titulo}</strong> — {data.desde && Date.parse(post.created_at) < Date.parse(data.desde) ? "Anterior a la activación; no se enviará" : nombres[post.estado] ?? post.estado}</summary>
      <div className="mt-3 space-y-3">
        {post.imagen_url && <img src={post.imagen_url} alt={`Placa de Instagram: ${post.titulo}`} className="w-48 rounded-lg" loading="lazy" />}
        {post.caption && <p className="whitespace-pre-wrap text-sm">{post.caption}</p>}
        {post.error && <p className="text-sm text-red-700">{post.error}</p>}
        {post.estado === "fallida" && <button type="button" className="text-sm underline disabled:opacity-50" disabled={busy || !data.configurada} onClick={() => void reintentar(post.noticia_id)}>Reintentar</button>}
      </div>
    </details>)}
  </section>;
}
