import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

// Delegate link clicks so desktop/mobile navigation and article cards receive
// the same instrumentation. Never send query strings or free-form link text.
export function VisitorAnalytics() {
  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const relativePath = (path: string) =>
      base && path.startsWith(`${base}/`) ? path.slice(base.length) : path;
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const path = relativePath(window.location.pathname);
      if (path.startsWith("/redactor")) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link) return;
      const url = new URL(link.href, window.location.href);
      const location = link.closest("footer") ? "footer"
        : link.closest("nav, header") ? "navigation" : "content";
      const page = /^\/noticia\/\d+\/?$/.test(path) ? "article"
        : ["/", "/river", "/fixture", "/equipo", "/historia", "/postula"].includes(path)
          ? path === "/" ? "home" : path.slice(1) : "other";

      if (url.hostname === "chat.whatsapp.com" ||
          (url.hostname === "whatsapp.com" && url.pathname.startsWith("/channel/"))) {
        trackEvent("community_link_clicked", { channel: "whatsapp", location, page });
      } else if (url.hostname === "t.me" && /^\/RiverPlateIsrael\/?$/i.test(url.pathname)) {
        trackEvent("community_link_clicked", { channel: "telegram", location, page });
      } else if (url.origin === window.location.origin) {
        const destination = relativePath(url.pathname);
        const article = destination.match(/^\/noticia\/(\d+)\/?$/);
        if (article) {
          trackEvent("article_link_clicked", { article_id: article[1], location, page });
        } else if (["/fixture", "/equipo", "/historia", "/postula"].includes(destination)) {
          trackEvent("section_link_clicked", { section: destination.slice(1), location, page });
        }
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}