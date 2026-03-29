import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const NAV_LINKS = [
  { name: "Inicio", href: "/" },
  { name: "Actualidad", href: "#actualidad" },
  { name: "Historia", href: "/historia" },
  { name: "Plantel Profesional Masculino", href: "/equipo" },
  { name: "Filial Ramat Gan", href: "#filial" },
  { name: "Galería", href: "#galeria" },
  { name: "Videos", href: "#videos" },
  { name: "Reacciones Post Partido", href: "#videos" },
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (href: string) => {
    setMobileMenuOpen(false);
    if (href.startsWith('#')) {
      const element = document.querySelector(href);
      if (element) {
        setTimeout(() => {
          const top = element.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top, behavior: 'smooth' });
        }, 80);
      } else {
        window.location.href = '/' + href;
      }
    }
  };

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out border-b border-transparent",
        isScrolled
          ? "bg-river-black/95 backdrop-blur-md py-3 shadow-lg border-white/10"
          : "bg-gradient-to-b from-black/80 to-transparent py-5"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 overflow-hidden rounded-full border-2 border-white shadow-[0_0_10px_rgba(204,0,0,0.5)] group-hover:scale-105 transition-transform">
              <div className="absolute inset-0 bg-diagonal-red"></div>
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-2xl text-white leading-none tracking-wide">
                RIVER EN ISRAEL
              </span>
              <span className="text-[0.65rem] text-gray-300 font-semibold uppercase tracking-widest flex items-center gap-1">
                <MapPin className="w-3 h-3 text-river-red" /> Ramat Gan 🇮🇱
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            {NAV_LINKS.map((link) =>
              link.href.startsWith("/") ? (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-white/90 hover:text-white font-medium text-sm uppercase tracking-wider relative group py-2"
                >
                  {link.name}
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-river-red transition-all duration-300 group-hover:w-full"></span>
                </Link>
              ) : (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => {
                    if (link.href.startsWith('#')) {
                      e.preventDefault();
                      handleNavClick(link.href);
                    }
                  }}
                  className="text-white/90 hover:text-white font-medium text-sm uppercase tracking-wider relative group py-2"
                >
                  {link.name}
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-river-red transition-all duration-300 group-hover:w-full"></span>
                </a>
              )
            )}
            <a
              href="https://whatsapp.com/channel/0029VbCkS5VHrDZiSDf9g01s"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-river-red hover:bg-river-red-hover text-white px-5 py-2 rounded-full font-bold uppercase tracking-wider text-sm transition-all shadow-[0_0_15px_rgba(204,0,0,0.4)] hover:shadow-[0_0_20px_rgba(204,0,0,0.6)] hover:-translate-y-0.5"
            >
              Unite a la Filial
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-white p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
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
            className="md:hidden bg-river-black border-t border-white/10 overflow-hidden"
          >
            <div className="flex flex-col px-4 pt-2 pb-6 space-y-2">
              {NAV_LINKS.map((link) =>
                link.href.startsWith("/") ? (
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
                      if (link.href.startsWith('#')) {
                        e.preventDefault();
                        handleNavClick(link.href);
                      }
                    }}
                    className="text-white/80 hover:text-white hover:bg-white/5 px-4 py-3 rounded-lg font-medium text-lg uppercase tracking-wider transition-colors"
                  >
                    {link.name}
                  </a>
                )
              )}
              <a
                href="https://whatsapp.com/channel/0029VbCkS5VHrDZiSDf9g01s"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-river-red text-white px-4 py-3 rounded-lg font-bold uppercase tracking-wider text-center mt-4"
              >
                Unite a la Filial
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
