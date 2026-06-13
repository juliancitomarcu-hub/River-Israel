const DEFAULT_TITLE = "River Plate en Israel - Noticias, Resultados y Comunidad";
const DEFAULT_DESCRIPTION =
  "Las últimas noticias de River Plate para los hinchas en Israel. Resultados en vivo, análisis y la comunidad millonaria en Ramat Gan";
const DEFAULT_IMAGE = "https://riverplateisrael.com/opengraph.jpg";

function setMetaTag(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export interface PageMeta {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "article";
}

export function setPageMeta(meta: PageMeta) {
  const title = meta.title ?? DEFAULT_TITLE;
  const description = (meta.description ?? DEFAULT_DESCRIPTION).slice(0, 160);
  const image = meta.image ?? DEFAULT_IMAGE;
  const url = meta.url ?? window.location.href;
  const type = meta.type ?? "website";

  document.title = title;
  setMetaTag("name", "description", description);
  setMetaTag("property", "og:type", type);
  setMetaTag("property", "og:title", title);
  setMetaTag("property", "og:description", description);
  setMetaTag("property", "og:image", image);
  setMetaTag("property", "og:url", url);
  setMetaTag("name", "twitter:card", "summary_large_image");
  setMetaTag("name", "twitter:title", title);
  setMetaTag("name", "twitter:description", description);
  setMetaTag("name", "twitter:image", image);
}

export function resetPageMeta() {
  setPageMeta({ type: "website" });
}

export function extraerDescripcion(texto: string, max = 160): string {
  const limpio = texto
    .replace(/[#•*_>`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (limpio.length <= max) return limpio;
  return limpio.slice(0, max - 1).trimEnd() + "…";
}
