import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Share2, Link2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  titulo: string;
  id: string | number;
  className?: string;
  compact?: boolean;
}

const FB_ICON = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const IG_ICON = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
  </svg>
);

const WA_ICON = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const X_ICON = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const TG_ICON = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

const MENU_WIDTH = 256;
const MENU_HEIGHT_APPROX = 380;

export default function ShareButton({ titulo, id, className, compact = false }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [igCopied, setIgCopied] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const url = typeof window !== "undefined" ? `${window.location.origin}/noticia/${id}` : `/noticia/${id}`;
  const texto = `${titulo} — River en Israel`;

  const computePos = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const enoughAbove = r.top >= MENU_HEIGHT_APPROX + margin;
    const enoughBelow = vh - r.bottom >= MENU_HEIGHT_APPROX + margin;
    const placeAbove = enoughAbove || !enoughBelow;
    let left = r.right - MENU_WIDTH;
    left = Math.max(margin, Math.min(vw - MENU_WIDTH - margin, left));
    const top = placeAbove ? r.top - MENU_HEIGHT_APPROX - 6 : r.bottom + 6;
    setPos({ top: Math.max(margin, top), left });
  }, []);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!open) computePos();
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => computePos();
    const onOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(t) && btnRef.current && !btnRef.current.contains(t)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, computePos]);

  const opciones: {
    label: string;
    sublabel?: string;
    icon: JSX.Element;
    bg: string;
    fg: string;
    action: () => void;
    keepOpen?: boolean;
  }[] = [
    {
      label: "WhatsApp",
      icon: <WA_ICON />,
      bg: "hover:bg-green-50",
      fg: "text-green-600",
      action: () => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto + "\n" + url)}`, "_blank"),
    },
    {
      label: "Facebook",
      icon: <FB_ICON />,
      bg: "hover:bg-blue-50",
      fg: "text-blue-600",
      action: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank"),
    },
    {
      label: "Instagram",
      sublabel: igCopied ? "Link copiado — pegalo en Stories" : "Copiar link para Stories",
      icon: <IG_ICON />,
      bg: "hover:bg-pink-50",
      fg: "text-pink-600",
      keepOpen: true,
      action: async () => {
        try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
        setIgCopied(true);
        setTimeout(() => setIgCopied(false), 3000);
      },
    },
    {
      label: "X (Twitter)",
      icon: <X_ICON />,
      bg: "hover:bg-gray-50",
      fg: "text-gray-800",
      action: () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(texto)}&url=${encodeURIComponent(url)}`, "_blank"),
    },
    {
      label: "Telegram",
      icon: <TG_ICON />,
      bg: "hover:bg-sky-50",
      fg: "text-sky-500",
      action: () => window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(texto)}`, "_blank"),
    },
    {
      label: copied ? "¡Copiado!" : "Copiar enlace",
      icon: copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />,
      bg: "hover:bg-gray-50",
      fg: copied ? "text-green-500" : "text-gray-400",
      keepOpen: true,
      action: async () => {
        try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
    },
  ];

  const menu = open && pos && typeof document !== "undefined" ? createPortal(
    <>
      <div
        className="fixed inset-0 z-[9998] bg-black/10 sm:bg-transparent"
        onClick={(e) => { e.stopPropagation(); setOpen(false); }}
      />
      <div
        ref={menuRef}
        role="menu"
        style={{ position: "fixed", top: pos.top, left: pos.left, width: MENU_WIDTH }}
        className="z-[9999] bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 overflow-hidden animate-in fade-in slide-in-from-bottom-1 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 pb-1 pt-0.5">
          Compartir en
        </p>
        {opciones.map((op) => (
          <button
            key={op.label}
            onClick={(e) => {
              e.stopPropagation();
              op.action();
              if (!op.keepOpen) setOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 transition-colors text-left",
              op.bg
            )}
          >
            <span className={cn("flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-gray-50", op.fg)}>
              {op.icon}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-gray-800 text-sm font-semibold leading-tight">{op.label}</span>
              {op.sublabel && (
                <span className="block text-gray-400 text-[10px] leading-tight mt-0.5 truncate">{op.sublabel}</span>
              )}
            </span>
            {op.label === "¡Copiado!" && <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
            {igCopied && op.label === "Instagram" && <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
          </button>
        ))}
        <div className="border-t border-gray-100 mt-1" />
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(false); }}
          className="w-full flex items-center justify-center gap-1 py-1.5 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-3 h-3" /> Cerrar
        </button>
      </div>
    </>,
    document.body
  ) : null;

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        ref={btnRef}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); } }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Compartir esta noticia"
        title="Compartir esta noticia"
        className={cn(
          "inline-flex items-center gap-2 text-sm font-bold transition-all rounded-full shadow-md hover:shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-river-red focus-visible:ring-offset-2",
          compact ? "p-2.5" : "px-4 py-2.5",
          open
            ? "bg-river-red text-white shadow-river-red/30"
            : "bg-river-red text-white hover:bg-river-red-hover hover:-translate-y-0.5",
        )}
      >
        <Share2 className="w-4 h-4" />
        {!compact && <span>Compartir</span>}
      </button>
      {menu}
    </div>
  );
}
