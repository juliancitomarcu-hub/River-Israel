import { useState, useEffect } from "react";
import { Link } from "wouter";
import { MapPin, Phone, Facebook, Instagram, Youtube, Twitter, MessageCircle, Send, X, Users } from "lucide-react";

// ─── HOOK: Contador de visitas persistente ────────────────────────────────────
// Usa localStorage para saber si es la primera visita del navegador.
// El contador real vive en PostgreSQL via API.

function useContadorVisitas() {
  const [conteo, setConteo] = useState<{ total: number; unicas: number } | null>(null);

  useEffect(() => {
    const clave = "river_israel_visitante";
    const esNuevo = !localStorage.getItem(clave);

    // Registrar la visita (total siempre, única solo si es nuevo navegador)
    fetch("/api/visitas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unica: esNuevo }),
    })
      .then((r) => r.json())
      .then((data: { total: number; unicas: number }) => {
        setConteo(data);
        if (esNuevo) {
          localStorage.setItem(clave, "1");
        }
      })
      .catch(() => {
        // Fallback: solo mostrar el conteo actual sin registrar
        fetch("/api/visitas")
          .then((r) => r.json())
          .then((data: { total: number; unicas: number }) => setConteo(data))
          .catch(() => {});
      });
  }, []);

  return conteo;
}

function formatearNumero(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".0", "")}K`;
  return n.toString();
}

export function Footer() {
  const [clicks, setClicks] = useState(0);
  const [formAbierto, setFormAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "ok" | "error">("idle");
  const visitas = useContadorVisitas();

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !mensaje.trim()) return;
    setEstado("enviando");
    try {
      const r = await fetch("/api/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), mensaje: mensaje.trim() }),
      });
      if (r.ok) {
        setEstado("ok");
        setNombre("");
        setMensaje("");
      } else {
        setEstado("error");
      }
    } catch {
      setEstado("error");
    }
  };

  const handleLogoClick = () => {
    const next = clicks + 1;
    setClicks(next);
    if (next >= 3) {
      setClicks(0);
      window.location.href = "/redactor";
    }
    setTimeout(() => setClicks(0), 1500);
  };

  return (
    <footer className="bg-river-black text-white border-t-4 border-river-red pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">

          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleLogoClick}
                className="relative w-12 h-12 overflow-hidden rounded-full border-2 border-white cursor-default select-none focus:outline-none"
                aria-hidden="true"
                tabIndex={-1}
              >
                <div className="absolute inset-0 bg-diagonal-red"></div>
              </button>
              <span className="font-display font-bold text-3xl">RIVER EN ISRAEL</span>
            </div>
            <p className="text-gray-400 max-w-sm mt-4">
              La filial oficial del Club Atlético River Plate en Medio Oriente.
              Viviendo la pasión por La Banda del Millonario desde la Tierra Santa. 🇦🇷 ❤️ 🇮🇱
            </p>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display text-xl mb-6 text-river-red">Contacto Filial</h4>
            <ul className="space-y-4 text-gray-300 mb-5">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-river-red shrink-0 mt-0.5" />
                <span>Ramat Gan, Distrito de Tel Aviv, Israel</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-river-red shrink-0" />
                <a href="https://wa.me/9720559421610" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">+972 055-942-1610</a>
              </li>
              <li>
                <button
                  onClick={() => { setFormAbierto(f => !f); setEstado("idle"); }}
                  className="flex items-center gap-2 bg-river-red hover:bg-river-red/80 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Escribinos
                </button>
              </li>
            </ul>

            {/* Mini formulario inline */}
            {formAbierto && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                {estado === "ok" ? (
                  <div className="text-center py-2">
                    <p className="text-green-400 font-bold text-sm">✅ ¡Mensaje enviado!</p>
                    <p className="text-gray-400 text-xs mt-1">Te respondemos pronto.</p>
                    <button onClick={() => { setFormAbierto(false); setEstado("idle"); }} className="mt-3 text-xs text-gray-500 hover:text-white underline">Cerrar</button>
                  </div>
                ) : (
                  <form onSubmit={handleEnviar} className="space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold text-white/60 uppercase tracking-wider">Mensaje rápido</p>
                      <button type="button" onClick={() => setFormAbierto(false)} className="text-white/30 hover:text-white transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input
                      value={nombre}
                      onChange={e => setNombre(e.target.value)}
                      placeholder="Tu nombre"
                      required
                      className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-river-red"
                    />
                    <textarea
                      value={mensaje}
                      onChange={e => setMensaje(e.target.value)}
                      placeholder="Tu consulta..."
                      required
                      rows={3}
                      className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-river-red resize-none"
                    />
                    {estado === "error" && <p className="text-red-400 text-xs">Error al enviar. Intentá de nuevo.</p>}
                    <button
                      type="submit"
                      disabled={estado === "enviando"}
                      className="w-full flex items-center justify-center gap-2 bg-river-red hover:bg-river-red/80 disabled:opacity-50 text-white text-sm font-bold py-2 rounded-lg transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {estado === "enviando" ? "Enviando..." : "Enviar consulta"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Social */}
          <div>
            <h4 className="font-display text-xl mb-6 text-river-red">Seguinos</h4>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-river-red transition-all hover:-translate-y-1">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="https://www.instagram.com/riverplateisrael?igsh=N2RlM2Y3Y25vdjMy&utm_source=qr" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-river-red transition-all hover:-translate-y-1">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-river-red transition-all hover:-translate-y-1">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-river-red transition-all hover:-translate-y-1">
                <Youtube className="w-5 h-5" />
              </a>
            </div>
            <div className="mt-8">
              <p className="text-sm text-gray-500 mb-1">Club Atlético River Plate Oficial</p>
              <a href="https://www.cariverplate.com.ar" target="_blank" rel="noreferrer" className="text-sm font-bold hover:text-river-red transition-colors">
                www.cariverplate.com.ar
              </a>
            </div>
          </div>
        </div>

        {/* ── CONTADOR DE VISITAS ──────────────────────────────────────────── */}
        <div className="border-t border-white/10 pt-8 mb-6">
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-4 bg-white rounded-2xl border-2 border-red-600 px-6 py-4 shadow-lg">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-red-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider leading-none mb-1">
                    Hinchas que pasaron por el Monumental Digital
                  </p>
                  <div className="flex items-baseline gap-3">
                    {visitas === null ? (
                      <span className="text-2xl font-black text-gray-300 font-display animate-pulse">···</span>
                    ) : (
                      <>
                        <span className="text-3xl font-black text-red-600 font-display leading-none">
                          {formatearNumero(visitas.total)}
                        </span>
                        <span className="text-sm text-gray-400">
                          visitas · <span className="font-semibold text-gray-600">{formatearNumero(visitas.unicas)}</span> únicas
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── COPYRIGHT ────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row items-center justify-between text-sm text-gray-500">
          <p>© {new Date().getFullYear()} River en Israel - Filial River Plate Israel. Todos los derechos reservados.</p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <a href="#" className="hover:text-white transition-colors">Privacidad</a>
            <a href="#" className="hover:text-white transition-colors">Términos</a>
            <Link href="/redactor" className="text-white/5 hover:text-white/5 transition-none select-none" tabIndex={-1} aria-hidden="true">1901</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
