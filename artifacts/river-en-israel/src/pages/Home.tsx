import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Trophy, ChevronRight, MapPin, ArrowRight, User } from "lucide-react";
import { useNews, useMatches } from "@/hooks/use-river-data";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import ProximoPartidoWidget from "@/components/ProximoPartidoWidget";
import ShareButton from "@/components/ShareButton";

export default function Home() {
  const [paginaActualidad, setPaginaActualidad] = useState(0);
  const { data: newsData } = useNews(paginaActualidad, "river");
  const news = newsData?.items ?? [];
  const totalPaginasNoticias = newsData?.totalPages ?? 1;
  const { data: matches } = useMatches();

  // Separar nota destacada + secundarias
  const notaDestacada = news[0];
  const secundarias = news.slice(1, 5); // Siguientes 4
  const resto = news.slice(5); // El resto para grid inferior

  const fadeIn = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } }
  };

  return (
    <div className="w-full bg-[#FAFAF8] newspaper-texture min-h-screen">
      
      {/* ══════════════════════════════════════════════════════════════ */}
      {/* CABECERA EDITORIAL — Masthead del diario                        */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section className="border-b-2 border-tinta bg-white pt-24 pb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center border-b border-gris-borde pb-4 mb-4">
            <h1 className="font-display text-5xl md:text-7xl tracking-tighter text-tinta leading-none mb-2">
              RIVER EN ISRAEL
            </h1>
            <p className="font-mono text-[10px] text-gris-meta uppercase tracking-widest">
              Filial River Plate Israel Gaby "Tucu" Sajnin · Edición digital {new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </div>
          
          {/* Escudos + ubicación */}
          <div className="flex items-center justify-center gap-8">
            <img
              src={`${import.meta.env.BASE_URL}filial-logo.jpeg`}
              alt="Escudo Filial"
              className="w-16 h-16 object-contain rounded-full border-2 border-gris-borde"
              draggable={false}
            />
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-gris-meta mb-1">
                <MapPin className="w-4 h-4 text-river-red" />
                <span className="font-mono text-xs uppercase tracking-wider">Ramat Gan, Israel</span>
              </div>
              <p className="text-sm text-tinta max-w-md">
                La banda millonaria latiendo fuerte desde Tierra Santa — 12.000 km del Monumental, la misma pasión.
              </p>
            </div>
            <img
              src={`${import.meta.env.BASE_URL}images/escudo-carp.png?v=4`}
              alt="Escudo River Plate"
              className="w-20 h-20 object-contain"
              draggable={false}
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* PORTADA EDITORIAL — Nota destacada + sidebar fixture            */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* ── Contenido principal (2 columnas) ── */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* NOTA DESTACADA */}
            {notaDestacada && (
              <motion.article
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-60px" }}
                variants={fadeIn}
                className="group bg-white border-t-4 border-river-red shadow-lg hover:shadow-xl transition-shadow duration-300"
              >
                <Link href={`/noticia/${notaDestacada.id}`}>
                  <div className="relative h-[400px] overflow-hidden">
                    <img
                      src={notaDestacada.imageUrl}
                      alt={notaDestacada.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <span className="inline-block bg-river-red text-white px-3 py-1 text-xs font-bold uppercase tracking-wider mb-3">
                        Nota destacada
                      </span>
                      <h2 className="font-display text-4xl md:text-5xl text-white leading-tight mb-3 group-hover:text-river-red transition-colors">
                        {notaDestacada.title}
                      </h2>
                      <p className="text-white/90 text-lg mb-4 line-clamp-2">{notaDestacada.excerpt}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-white/70 text-sm font-mono">
                          <Calendar className="w-4 h-4" />
                          <span>{notaDestacada.date}</span>
                        </div>
                        <ShareButton titulo={notaDestacada.title} id={notaDestacada.id} compact />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.article>
            )}

            {/* SECUNDARIAS — Grid 2x2 */}
            {secundarias.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {secundarias.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: "-60px" }}
                    variants={fadeIn}
                    transition={{ delay: i * 0.1 }}
                  >
                    <Link href={`/noticia/${item.id}`}>
                      <article className="group bg-white border border-gris-borde hover:border-river-red transition-all duration-300 overflow-hidden h-full flex flex-col">
                        <div className="relative h-48 overflow-hidden">
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                        <div className="p-4 flex-1 flex flex-col">
                          <h3 className="font-display text-xl text-tinta group-hover:text-river-red transition-colors leading-tight mb-2 line-clamp-3">
                            {item.title}
                          </h3>
                          <p className="text-gris-meta text-sm line-clamp-2 mb-3 flex-1">{item.excerpt}</p>
                          <div className="flex items-center justify-between pt-3 border-t border-gris-borde">
                            <span className="font-mono text-xs text-gris-meta">{item.date}</span>
                            <span className="inline-flex items-center gap-1 text-river-red text-xs font-bold group-hover:gap-2 transition-all">
                              Leer <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      </article>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}

            {/* RESTO DE NOTICIAS — Lista compacta */}
            {resto.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-display text-2xl text-tinta border-b-2 border-tinta pb-2 mb-4">
                  Más noticias
                </h3>
                {resto.map((item) => (
                  <motion.div
                    key={item.id}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: "-60px" }}
                    variants={fadeIn}
                  >
                    <Link href={`/noticia/${item.id}`}>
                      <article className="group flex gap-4 bg-white border-b border-gris-borde pb-3 hover:border-river-red transition-colors">
                        <div className="relative overflow-hidden w-24 h-24 flex-shrink-0">
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-display text-lg text-tinta group-hover:text-river-red transition-colors leading-tight mb-1 line-clamp-2">
                            {item.title}
                          </h4>
                          <p className="text-gris-meta text-xs line-clamp-1 mb-2">{item.excerpt}</p>
                          <span className="font-mono text-xs text-gris-meta">{item.date}</span>
                        </div>
                      </article>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Paginación */}
            {totalPaginasNoticias > 1 && (() => {
              const VENTANA = 6;
              const inicio = Math.floor(paginaActualidad / VENTANA) * VENTANA;
              const fin = Math.min(inicio + VENTANA, totalPaginasNoticias);
              const paginas = Array.from({ length: fin - inicio }, (_, k) => inicio + k);
              const hayPrevios = inicio > 0;
              const hayMas = fin < totalPaginasNoticias;
              const ir = (i: number) => { setPaginaActualidad(i); window.scrollTo({ top: 0, behavior: "smooth" }); };
              return (
                <div className="flex items-center justify-center gap-2 mt-8 pt-6 border-t-2 border-gris-borde flex-wrap">
                  {hayPrevios && (
                    <button
                      onClick={() => ir(inicio - 1)}
                      className="px-4 h-10 flex items-center justify-center border-2 border-tinta text-tinta hover:bg-tinta hover:text-white transition-all font-bold uppercase tracking-wide text-xs"
                      aria-label="Páginas anteriores"
                    >
                      ‹ Anterior
                    </button>
                  )}

                  {paginas.map(i => (
                    <button
                      key={i}
                      onClick={() => ir(i)}
                      className={`w-10 h-10 flex items-center justify-center text-sm font-bold transition-all border-2 ${
                        i === paginaActualidad
                          ? "bg-river-red text-white border-river-red"
                          : "border-gris-borde text-tinta hover:border-tinta"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}

                  {hayMas && (
                    <button
                      onClick={() => ir(fin)}
                      className="px-4 h-10 flex items-center justify-center border-2 border-tinta text-tinta hover:bg-tinta hover:text-white transition-all font-bold uppercase tracking-wide text-xs"
                      aria-label="Páginas siguientes"
                    >
                      Siguiente ›
                    </button>
                  )}
                </div>
              );
            })()}
          </div>

          {/* ── Sidebar: Fixture + ProximoPartido ── */}
          <aside className="lg:sticky lg:top-24 self-start space-y-6">
            
            {/* Próximo partido destacado */}
            <div className="bg-white border-2 border-tinta p-4">
              <h3 className="font-display text-xl text-tinta mb-3 border-b-2 border-river-red pb-2">
                Próximo partido
              </h3>
              <ProximoPartidoWidget />
            </div>

            {/* Fixture resumido */}
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={fadeIn}
              className="bg-tinta text-white p-4 border-2 border-tinta"
            >
              <h3 className="font-display text-xl mb-3 flex items-center gap-2 border-b border-white/20 pb-2">
                <Trophy className="w-5 h-5 text-river-red" /> Fixture y Resultados
              </h3>

              <div className="space-y-3">
                {!matches && (
                  <div className="flex justify-center py-6">
                    <div className="w-6 h-6 border-2 border-river-red border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {matches && (() => {
                  const proximos = matches.filter(m => m.status === 'UPCOMING').slice(0, 2);
                  const jugados = matches.filter(m => m.status === 'FINISHED' || m.status === 'LIVE').slice(0, 2);
                  return [...jugados, ...proximos];
                })().map((match) => {
                  const [golesRiver, golesRival] = match.isRiverHome
                    ? [match.homeScore, match.awayScore]
                    : [match.awayScore, match.homeScore];
                  const ganamos = match.status === 'FINISHED' && golesRiver !== null && golesRival !== null && golesRiver > golesRival;
                  const perdimos = match.status === 'FINISHED' && golesRiver !== null && golesRival !== null && golesRiver < golesRival;

                  return (
                    <div key={match.id} className="bg-white/5 border border-white/20 p-3 hover:bg-white/10 transition-colors">
                      <div className="flex justify-between items-center text-[10px] text-white/50 mb-2 font-mono">
                        <span className="font-semibold text-white/70 truncate max-w-[120px]">{match.competition}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {match.status === 'LIVE' && (
                            <span className="flex items-center gap-1 bg-green-500 text-white px-1.5 py-0.5 text-[9px] font-bold animate-pulse">
                              EN VIVO
                            </span>
                          )}
                          {match.status === 'FINISHED' && (
                            <span className={cn(
                              "px-1.5 py-0.5 text-[9px] font-bold",
                              ganamos ? "bg-green-600 text-white" : perdimos ? "bg-red-700 text-white" : "bg-gray-600 text-white"
                            )}>
                              {ganamos ? "Victoria" : perdimos ? "Derrota" : "Empate"}
                            </span>
                          )}
                          <span>{match.date}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className={cn("font-bold text-sm truncate", match.isRiverHome ? "text-white" : "text-white/50")}>
                            {match.homeTeam}
                          </div>
                          {(match.status === 'FINISHED' || match.status === 'LIVE') && (
                            <div className={cn("font-display text-2xl font-bold tabular-nums", match.isRiverHome ? "text-white" : "text-white/50")}>
                              {match.homeScore ?? 0}
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-white/30 text-xs font-bold">
                          {match.status === 'FINISHED' || match.status === 'LIVE' ? '—' : 'vs'}
                        </div>
                        <div className="flex-1 min-w-0 text-right">
                          <div className={cn("font-bold text-sm truncate", !match.isRiverHome ? "text-white" : "text-white/50")}>
                            {match.awayTeam}
                          </div>
                          {(match.status === 'FINISHED' || match.status === 'LIVE') && (
                            <div className={cn("font-display text-2xl font-bold tabular-nums", !match.isRiverHome ? "text-white" : "text-white/50")}>
                              {match.awayScore ?? 0}
                            </div>
                          )}
                        </div>
                      </div>

                      {match.status === 'UPCOMING' && match.horaIsrael && (
                        <p className="text-[10px] text-river-red font-semibold mt-2 text-center font-mono">
                          {match.horaIsrael}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <Link href="/fixture">
                <button className="w-full mt-4 bg-white text-tinta hover:bg-river-red hover:text-white font-bold py-2 transition-colors text-sm uppercase tracking-wide">
                  Fixture completo
                </button>
              </Link>
            </motion.div>

            {/* CTA WhatsApp */}
            <div className="bg-river-red text-white p-4 border-2 border-river-red">
              <h3 className="font-display text-lg mb-2">Unite a la Filial</h3>
              <p className="text-sm mb-3 text-white/90">Seguí las noticias y eventos de River en Israel.</p>
              <a
                href="https://chat.whatsapp.com/LGMvmF1bKjJ2PlZ1GqCfo0"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white text-river-red hover:bg-gris-suave font-bold px-4 py-2 transition-colors text-sm w-full justify-center"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Canal de WhatsApp
              </a>
              <a
                href="https://t.me/RiverPlateIsrael"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-tinta text-white hover:bg-tinta/80 font-bold px-4 py-2 transition-colors text-sm w-full justify-center mt-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                Canal de Telegram
              </a>
            </div>
          </aside>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* SECCIONES COMPLEMENTARIAS — Historia, Filial, etc.             */}
      {/* ══════════════════════════════════════════════════════════════ */}
      
      {/* Llamado a la filial */}
      <section id="filial" className="bg-tinta text-white py-16 border-t-4 border-river-red">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-4xl md:text-5xl mb-4">
            Sumate a la Filial River Plate Israel Gaby "Tucu" Sajnin
          </h2>
          <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
            Somos hinchas de River que vivimos la pasión millonaria desde Israel. 
            Eventos, partidos en vivo, asados, y mucho más. ¡Unite!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://chat.whatsapp.com/LGMvmF1bKjJ2PlZ1GqCfo0"
              target="_blank"
              rel="noopener noreferrer"
            >
              <button className="inline-flex items-center gap-2 bg-river-red hover:bg-river-red-hover text-white font-bold px-8 py-3 transition-colors uppercase tracking-wide">
                Conocé la filial <ArrowRight className="w-4 h-4" />
              </button>
            </a>
            <Link href="/postula">
              <button className="inline-flex items-center gap-2 bg-white text-tinta hover:bg-gris-suave font-bold px-8 py-3 transition-colors uppercase tracking-wide">
                <User className="w-4 h-4" /> Postulate como socio
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer ligero con links rápidos */}
      <section className="bg-white border-t-2 border-gris-borde py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center md:text-left">
            <div>
              <h4 className="font-display text-lg text-tinta mb-2">Navegación</h4>
              <ul className="space-y-1 text-sm">
                <li><Link href="/historia"><span className="text-gris-meta hover:text-river-red transition-colors cursor-pointer">Historia</span></Link></li>
                <li><Link href="/equipo"><span className="text-gris-meta hover:text-river-red transition-colors cursor-pointer">Plantel</span></Link></li>
                <li><Link href="/fixture"><span className="text-gris-meta hover:text-river-red transition-colors cursor-pointer">Fixture</span></Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-display text-lg text-tinta mb-2">La Filial</h4>
              <ul className="space-y-1 text-sm">
                <li><Link href="/historia" className="text-gris-meta hover:text-river-red transition-colors">Nuestra historia</Link></li>
                <li><Link href="/equipo" className="text-gris-meta hover:text-river-red transition-colors">Plantel</Link></li>
                <li><Link href="/fixture" className="text-gris-meta hover:text-river-red transition-colors">Fixture</Link></li>
                <li><Link href="/galeria" className="text-gris-meta hover:text-river-red transition-colors">Galería</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-display text-lg text-tinta mb-2">Redes</h4>
              <ul className="space-y-1 text-sm">
                <li>
                  <a href="https://www.instagram.com/riverplateisrael" target="_blank" rel="noopener noreferrer" className="text-gris-meta hover:text-river-red transition-colors">
                    Instagram
                  </a>
                </li>
                <li>
                  <a href="https://www.facebook.com/share/1ANhvcjefr" target="_blank" rel="noopener noreferrer" className="text-gris-meta hover:text-river-red transition-colors">
                    Facebook
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-display text-lg text-tinta mb-2">Contacto</h4>
              <p className="text-sm text-gris-meta">
                <MapPin className="w-3 h-3 inline mr-1" />
                Ramat Gan, Israel
              </p>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-gris-borde text-center">
            <p className="font-mono text-xs text-gris-meta">
              © {new Date().getFullYear()} River Plate en Israel — Filial River Plate Israel Gaby "Tucu" Sajnin · Vamos River 🔴⚪️
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
