import { Link } from "wouter";
import { MapPin, Instagram, Facebook } from "lucide-react";
import { useMundialMode } from "@/lib/mundial-mode";
import { cn } from "@/lib/utils";

export function Footer() {
  const mundialActivo = useMundialMode();

  if (mundialActivo) {
    // Footer Mundial
    return (
      <footer className="bg-[#0a1628] border-t-4 border-arg-dorado text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex justify-center items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full border-2 border-arg-dorado flex flex-col overflow-hidden">
                <div className="flex-1 bg-arg-celeste"></div>
                <div className="flex-1 bg-white"></div>
                <div className="flex-1 bg-arg-celeste"></div>
              </div>
              <h3 className="font-display text-2xl">
                LA <span className="text-arg-celeste">SCALONETA</span> EN ISRAEL
              </h3>
            </div>
            <p className="text-white/60 text-sm mb-6 max-w-xl mx-auto">
              Filial de hinchas de la Selección Argentina en Israel. Vamos por el tricampeonato.
            </p>
            <div className="border-t border-arg-celeste/20 pt-6">
              <p className="text-white/40 text-xs font-mono">
                © {new Date().getFullYear()} La Scaloneta en Israel · Filial de hinchas argentinos
              </p>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  // Footer River (editorial)
  return (
    <footer className="bg-white border-t-4 border-tinta text-tinta py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          
          {/* Columna 1: Identidad */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-full border-2 border-tinta overflow-hidden">
                <div className="w-full h-full bg-diagonal-red"></div>
              </div>
              <div>
                <h3 className="font-display text-2xl leading-none">RIVER EN ISRAEL</h3>
                <p className="text-xs text-gris-meta font-mono uppercase tracking-wider">
                  Filial Ramat Gan "El Tucu Sajnin"
                </p>
              </div>
            </div>
            <p className="text-sm text-gris-meta leading-relaxed max-w-md">
              La banda millonaria latiendo fuerte desde Tierra Santa. Somos hinchas de River que vivimos la pasión a 12.000 km del Monumental — la misma sangre, el mismo grito.
            </p>
            <div className="flex items-center gap-2 mt-4 text-sm text-gris-meta">
              <MapPin className="w-4 h-4 text-river-red" />
              <span>Ramat Gan, Israel</span>
            </div>
          </div>

          {/* Columna 2: Navegación */}
          <div>
            <h4 className="font-display text-lg mb-3 border-b border-gris-borde pb-2">NAVEGACIÓN</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/">
                  <span className="text-gris-meta hover:text-river-red transition-colors cursor-pointer font-semibold">
                    Portada
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/historia">
                  <span className="text-gris-meta hover:text-river-red transition-colors cursor-pointer font-semibold">
                    Historia
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/equipo">
                  <span className="text-gris-meta hover:text-river-red transition-colors cursor-pointer font-semibold">
                    Plantel
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/fixture">
                  <span className="text-gris-meta hover:text-river-red transition-colors cursor-pointer font-semibold">
                    Fixture
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/postula">
                  <span className="text-gris-meta hover:text-river-red transition-colors cursor-pointer font-semibold">
                    Postulate
                  </span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Columna 3: Redes y contacto */}
          <div>
            <h4 className="font-display text-lg mb-3 border-b border-gris-borde pb-2">SEGUINOS</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href="https://www.instagram.com/riverplateisrael"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gris-meta hover:text-river-red transition-colors font-semibold"
                >
                  <Instagram className="w-4 h-4" />
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href="https://www.facebook.com/share/1ANhvcjefr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gris-meta hover:text-river-red transition-colors font-semibold"
                >
                  <Facebook className="w-4 h-4" />
                  Facebook
                </a>
              </li>
              <li>
                <a
                  href="https://whatsapp.com/channel/0029VbCkS5VHrDZiSDf9g01s"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gris-meta hover:text-river-red transition-colors font-semibold"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Línea final */}
        <div className="border-t-2 border-gris-borde pt-6 text-center">
          <p className="font-mono text-xs text-gris-meta">
            © {new Date().getFullYear()} River Plate en Israel — Filial Ramat Gan "El Tucu Sajnin" · Todos los derechos reservados
          </p>
          <p className="font-mono text-xs text-gris-meta mt-2">
            Vamos River 🔴⚪️
          </p>
        </div>
      </div>
    </footer>
  );
}
