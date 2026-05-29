import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, MapPin, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useMundialMode } from "@/lib/mundial-mode";
import { SolDeMayo } from "@/components/SolDeMayo";

type NavLink = { name: string; href: string };

const NAV_LINKS_RIVER: NavLink[] = [
  { name: "Inicio",           href: "/river" },
  { name: "Historia",         href: "/historia" },
  { name: "Plantel",          href: "/equipo" },
  { name: "Nuestra Filial",   href: "/river#filial" },
  { name: "Galería",          href: "/river#galeria" },
  { name: "Videos",           href: "/river#videos" },
  { name: "Próximos Eventos", href: "/river#eventos" },
];

const NAV_LINKS_SCALONETA: NavLink[] = [
  { name: "Inicio",           href: "/" },
  { name: "Grupos",           href: "/#grupos" },
  { name: "Plantel",          href: "/#plantel" },
  { name: "Estadios",         href: "/#estadios" },
  { name: "Galería y Videos", href: "/#galeria-videos" },
  { name: "Fixture Mundial",  href: "/mundial/fixture" },
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [siteMenuOpen, setSiteMenuOpen] = useState(false);
  const siteMenuRef = useRef<HTMLDivElement>(null);
  const [location] = useLocation();
  const mundialActivo = useMundialMode();
  const navLinks = mundialActivo ? NAV_LINKS_SCALONETA : NAV_LINKS_RIVER;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!siteMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (siteMenuRef.current && !siteMenuRef.current.contains(e.target as Node)) {
        setSiteMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSiteMenuOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [siteMenuOpen]);

  // Scroll to anchor if href has hash (and we're already on the right page)
  const handleNavClick = (href: string) => {
    setMobileMenuOpen(false);
    if (href.includes("#")) {
      const [path, hash] = href.split("#");
      const targetPath = path || "/";
      const onTargetPage = location === targetPath || (targetPath === "/" && location === "");
      if (onTargetPage) {
        const el = document.getElementById(hash);
        if (el) {
          setTimeout(() => {
            const top = el.getBoundingClientRect().top + window.scrollY - 80;
            window.scrollTo({ top, behavior: "smooth" });
          }, 80);
        }
      } else {
        window.location.href = href;
      }
    }
  };

  const logoHref = mundialActivo ? "/" : "/river";

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out border-b border-transparent",
        isScrolled
          ? mundialActivo
            ? "bg-[#0a1628]/95 backdrop-blur-md py-2 shadow-lg border-arg-celeste/20"
            : "bg-river-black/95 backdrop-blur-md py-2 shadow-lg border-white/10"
          : "bg-gradient-to-b from-black/80 to-transparent py-3"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 md:gap-4">

          {/* Logo */}
          <Link href={logoHref} className="flex items-center gap-2 group shrink-0 min-w-0">
            <div className={cn(
              "escudo-river relative w-10 h-10 overflow-hidden rounded-full border-2 border-white group-hover:scale-105 transition-transform shrink-0",
              mundialActivo
                ? "shadow-[0_0_16px_rgba(241,184,45,0.65)] border-arg-dorado"
                : "shadow-[0_0_10px_rgba(204,0,0,0.5)]"
            )}>
              {mundialActivo ? (
                <>
                  <div className="absolute inset-0 flex flex-col">
                    <div className="flex-1 bg-arg-celeste"></div>
                    <div className="flex-1 bg-white"></div>
                    <div className="flex-1 bg-arg-celeste"></div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <SolDeMayo size={22} />
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 bg-diagonal-red"></div>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-display font-bold text-base sm:text-lg lg:text-xl text-white leading-none tracking-wide truncate">
                {mundialActivo ? (
                  <>LA <span className="text-arg-celeste">SCALONETA</span> <span className="text-arg-dorado">EN ISRAEL</span></>
                ) : "RIVER EN ISRAEL"}
              </span>
              <span className="text-[0.55rem] text-gray-300 font-semibold tracking-wide flex items-center gap-0.5 truncate">
                <MapPin className={cn("w-2.5 h-2.5 shrink-0", mundialActivo ? "text-arg-dorado" : "text-river-red")} />
                {mundialActivo ? "Filial Israel" : "Filial River Israel \"El TUCU\" SAJNIN"}
              </span>
            </div>
          </Link>

          {/* Dropdown desplegable: alternar entre sitios */}
          <div ref={siteMenuRef} className="hidden sm:block relative shrink-0">
            <button
              type="button"
              onClick={() => setSiteMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={siteMenuOpen}
              title="Cambiar de sitio"
              className={cn(
                "inline-flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full shadow-md transition-all hover:-translate-y-0.5 whitespace-nowrap",
                mundialActivo
                  ? "bg-gradient-to-r from-[#74ACDF] to-[#F1B82D] text-[#0a1628] hover:brightness-110"
                  : "bg-gradient-to-r from-river-red to-[#a00000] text-white hover:brightness-110"
              )}
            >
              {mundialActivo ? "🇦🇷 La Scaloneta" : "⚪️🔴 River en Israel"}
              <ChevronDown className={cn("w-3 h-3 transition-transform", siteMenuOpen && "rotate-180")} />
            </button>
            <AnimatePresence>
              {siteMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  role="menu"
                  className="absolute right-0 mt-2 min-w-[220px] rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-[#0a1628]/95 backdrop-blur-md z-50"
                >
                  <Link
                    href="/"
                    onClick={() => setSiteMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-colors",
                      mundialActivo ? "text-arg-dorado" : "text-white"
                    )}
                  >
                    🇦🇷 La Scaloneta en Israel
                  </Link>
                  <Link
                    href="/river"
                    onClick={() => setSiteMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-colors border-t border-white/10",
                      !mundialActivo ? "text-river-red" : "text-white"
                    )}
                  >
                    ⚪️🔴 River en Israel
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-2 lg:gap-4">
            {navLinks.map((link) =>
              link.href.startsWith("/") && !link.href.includes("#") ? (
                <Link
                  key={link.name}
                  href={link.href}
                  className={cn(
                    "text-white/90 hover:text-white font-medium text-[0.7rem] lg:text-xs uppercase tracking-wide relative group py-1 whitespace-nowrap",
                  )}
                >
                  {link.name}
                  <span className={cn(
                    "absolute bottom-0 left-0 w-0 h-0.5 transition-all duration-300 group-hover:w-full",
                    mundialActivo ? "bg-arg-dorado" : "bg-river-red"
                  )}></span>
                </Link>
              ) : (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => {
                    if (link.href.includes("#")) {
                      const [path] = link.href.split("#");
                      const onPage = location === (path || "/");
                      if (onPage) {
                        e.preventDefault();
                        handleNavClick(link.href);
                      }
                    }
                  }}
                  className="text-white/90 hover:text-white font-medium text-[0.7rem] lg:text-xs uppercase tracking-wide relative group py-1 whitespace-nowrap"
                >
                  {link.name}
                  <span className={cn(
                    "absolute bottom-0 left-0 w-0 h-0.5 transition-all duration-300 group-hover:w-full",
                    mundialActivo ? "bg-arg-dorado" : "bg-river-red"
                  )}></span>
                </a>
              )
            )}
            {/* WhatsApp solo en modo River (la Scaloneta no tiene grupo propio) */}
            {!mundialActivo && (
              <a
                href="https://chat.whatsapp.com/LGMvmF1bKjJ2PlZ1GqCfo0"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 bg-river-red hover:bg-river-red-hover text-white px-3 py-1.5 rounded-full font-bold uppercase tracking-wide text-[0.65rem] lg:text-xs transition-all shadow-[0_0_12px_rgba(204,0,0,0.4)] hover:shadow-[0_0_18px_rgba(204,0,0,0.6)] hover:-translate-y-0.5 whitespace-nowrap"
              >
                Unite al WhatsApp
              </a>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-white p-2 shrink-0"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menú"
          >
            {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={cn(
              "md:hidden border-t overflow-hidden",
              mundialActivo
                ? "bg-[#0a1628] border-arg-celeste/20"
                : "bg-river-black border-white/10"
            )}
          >
            <div className="flex flex-col px-4 pt-2 pb-6 space-y-2">
              {/* Cross-links prominentes arriba en mobile: ambos sitios */}
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-3 rounded-lg font-bold uppercase tracking-wider text-center bg-gradient-to-r from-[#74ACDF] to-[#F1B82D] text-[#0a1628]"
              >
                🇦🇷 La Scaloneta en Israel
              </Link>
              <Link
                href="/river"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-3 rounded-lg font-bold uppercase tracking-wider text-center bg-gradient-to-r from-river-red to-[#a00000] text-white"
              >
                ⚪️🔴 River en Israel
              </Link>

              {navLinks.map((link) =>
                link.href.startsWith("/") && !link.href.includes("#") ? (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-white/80 hover:text-white hover:bg-white/5 px-4 py-3 rounded-lg font-medium text-lg uppercase tracking-wider transition-colors"
                  >
                    {link.name}
                  </Link>
                ) : (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={(e) => {
                      if (link.href.includes("#")) {
                        const [path] = link.href.split("#");
                        const onPage = location === (path || "/");
                        if (onPage) {
                          e.preventDefault();
                          handleNavClick(link.href);
                        }
                      }
                    }}
                    className="text-white/80 hover:text-white hover:bg-white/5 px-4 py-3 rounded-lg font-medium text-lg uppercase tracking-wider transition-colors"
                  >
                    {link.name}
                  </a>
                )
              )}
              {/* WhatsApp solo en River */}
              {!mundialActivo && (
                <a
                  href="https://chat.whatsapp.com/LGMvmF1bKjJ2PlZ1GqCfo0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-river-red text-white px-4 py-3 rounded-lg font-bold uppercase tracking-wider text-center mt-4"
                >
                  Unite al grupo de WhatsApp
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
