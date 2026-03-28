import { motion } from "framer-motion";
import { Play, Calendar, Trophy, ChevronRight, CheckCircle2, ChevronDown } from "lucide-react";
import { useNews, useMatches, useHistoryTimeline, useSubmitContact } from "@/hooks/use-river-data";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

const contactSchema = z.object({
  name: z.string().min(2, "El nombre es muy corto"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(6, "Teléfono muy corto"),
  message: z.string().min(10, "El mensaje debe tener al menos 10 caracteres"),
});
type ContactFormValues = z.infer<typeof contactSchema>;

export default function Home() {
  const { data: news } = useNews();
  const { data: matches } = useMatches();
  const { data: timeline } = useHistoryTimeline();
  const submitContact = useSubmitContact();

  const { register, handleSubmit, formState: { errors, isSubmitSuccessful }, reset } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema)
  });

  const onSubmit = (data: ContactFormValues) => {
    submitContact.mutate(data, {
      onSuccess: () => reset()
    });
  };

  const fadeIn = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <div className="w-full bg-background overflow-hidden">

      {/* ================= HERO / PORTADA ================= */}
      <section className="relative w-full bg-river-black overflow-hidden" style={{ aspectRatio: "1200/420", maxHeight: "520px", minHeight: "260px" }}>
        {/* Banner de portada */}
        <img
          src={`${import.meta.env.BASE_URL}images/hero-monumental.png?v=2`}
          alt="Portada River en Israel"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />

        {/* Layout: texto izquierda, escudo derecha */}
        <div className="absolute inset-0 z-10 flex items-end justify-between px-6 sm:px-10 md:px-16 pb-1 sm:pb-2 bg-gradient-to-t from-black/75 via-black/20 to-transparent">

          {/* Texto — izquierda */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-col max-w-[58%]"
          >
            <p className="text-base sm:text-xl md:text-2xl text-gray-100 mb-4 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] font-medium leading-snug">
              La Banda del Millonario latiendo fuerte desde Tierra Santa.<br />
              La misma pasión a miles de kilómetros.
            </p>
            <div className="flex flex-row gap-3">
              <a
                href="https://chat.whatsapp.com/CVctijXuwxmEJMpU4jmFMv?mode=gi_t"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-river-red text-white font-bold rounded-full text-sm uppercase tracking-wider hover:bg-river-red-hover transition-all hover:scale-105 shadow-[0_0_16px_rgba(204,0,0,0.5)]"
              >
                Unite a la Filial
              </a>
              <a href="#actualidad" className="px-5 py-2.5 bg-white/15 backdrop-blur-sm text-white border border-white/30 font-bold rounded-full text-sm uppercase tracking-wider hover:bg-white/25 transition-all">
                Últimas Noticias
              </a>
            </div>
          </motion.div>

          {/* Escudo — derecha */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="relative flex-shrink-0 self-center"
          >
            <div className="absolute inset-0 bg-river-red/20 blur-3xl rounded-full scale-110" />
            <img
              src={`${import.meta.env.BASE_URL}escudo-filial.png`}
              alt="Escudo Filial River en Israel"
              className="relative z-10 w-36 h-36 sm:w-52 sm:h-52 md:w-64 md:h-64 object-contain"
              style={{ filter: "drop-shadow(0 4px 28px rgba(204,0,0,0.9))" }}
              draggable={false}
            />
          </motion.div>
        </div>

        {/* Línea roja inferior */}
        <div className="absolute bottom-0 inset-x-0 h-1 bg-river-red z-20" />
      </section>

      {/* ================= ACTUALIDAD SECTION ================= */}
      <section id="actualidad" className="py-24 bg-gray-50 relative">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-river-red to-transparent"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div>
              <h2 className="text-4xl md:text-5xl font-display font-bold text-river-black">Actualidad <span className="text-river-red">Millonaria</span></h2>
              <p className="text-muted-foreground mt-2 text-lg">Lo último del mundo River y nuestra filial.</p>
            </div>
            <Button variant="outline" className="rounded-full border-river-red text-river-red hover:bg-river-red hover:text-white">
              Ver todas las noticias
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* News Grid */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              {news?.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: "-100px" }}
                  variants={fadeIn}
                  className={cn(i === 0 ? "md:col-span-2" : "")}
                >
                  <Link href={`/noticia/${item.id}`}>
                    <div className="group bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 cursor-pointer h-full">
                      <div className={cn("relative overflow-hidden", i === 0 ? "h-64 md:h-80" : "h-48")}>
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors z-10"></div>
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-4 left-4 z-20">
                          <span className="bg-river-red text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-md">
                            {item.category}
                          </span>
                        </div>
                      </div>
                      <div className="p-6">
                        <span className="text-sm text-gray-500 flex items-center gap-2 mb-2">
                          <Calendar className="w-4 h-4" /> {item.date}
                        </span>
                        <h3 className={cn("font-display font-bold text-river-black group-hover:text-river-red transition-colors mb-3", i === 0 ? "text-2xl" : "text-xl")}>
                          {item.title}
                        </h3>
                        <p className="text-gray-600 line-clamp-2">{item.excerpt}</p>
                        <span className="inline-flex items-center gap-1 mt-4 text-river-red text-sm font-bold group-hover:gap-2 transition-all">
                          Leer nota completa <ChevronRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* Matches Sidebar */}
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={fadeIn}
              className="bg-river-black rounded-2xl p-6 shadow-2xl text-white relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-river-red blur-[80px] rounded-full opacity-50"></div>

              <h3 className="font-display text-2xl font-bold mb-6 flex items-center gap-3 relative z-10">
                <Trophy className="text-river-red" /> Fixture y Resultados
              </h3>

              <div className="space-y-3 relative z-10 max-h-[520px] overflow-y-auto pr-1 scrollbar-thin">
                {!matches && (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-2 border-river-red border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {matches?.map((match) => {
                  const [golesRiver, golesRival] = match.isRiverHome
                    ? [match.homeScore, match.awayScore]
                    : [match.awayScore, match.homeScore];
                  const ganamos = match.status === 'FINISHED' && golesRiver !== null && golesRival !== null && golesRiver > golesRival;
                  const perdimos = match.status === 'FINISHED' && golesRiver !== null && golesRival !== null && golesRiver < golesRival;
                  const empate = match.status === 'FINISHED' && golesRiver !== null && golesRival !== null && golesRiver === golesRival;

                  return (
                    <div key={match.id} className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-colors">
                      <div className="flex justify-between items-center text-xs text-gray-400 mb-2">
                        <span className="font-semibold text-gray-300">{match.competition}</span>
                        <div className="flex items-center gap-1.5">
                          {match.status === 'LIVE' && (
                            <span className="flex items-center gap-1 bg-green-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold animate-pulse">
                              🔴 EN VIVO
                            </span>
                          )}
                          {match.status === 'FINISHED' && (
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-bold",
                              ganamos ? "bg-green-600 text-white" : perdimos ? "bg-red-700 text-white" : "bg-gray-600 text-white"
                            )}>
                              {ganamos ? "✓ Ganamos" : perdimos ? "✗ Perdimos" : "= Empate"}
                            </span>
                          )}
                          <span>{match.date}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={cn("flex-1 font-bold text-sm truncate", match.isRiverHome ? "text-white" : "text-gray-300")}>
                          {match.homeTeam}
                        </span>
                        <div className="font-display text-lg bg-black/40 px-2.5 py-0.5 rounded tabular-nums flex-shrink-0">
                          {match.status === 'FINISHED' || match.status === 'LIVE'
                            ? <span>{match.homeScore} <span className="text-river-red/70">-</span> {match.awayScore}</span>
                            : <span className="text-gray-400 text-sm">vs</span>
                          }
                        </div>
                        <span className={cn("flex-1 font-bold text-sm text-right truncate", !match.isRiverHome ? "text-white" : "text-gray-300")}>
                          {match.awayTeam}
                        </span>
                      </div>

                      {match.status === 'UPCOMING' && match.horaIsrael && (
                        <p className="text-xs text-river-red font-semibold mt-1.5 text-center">
                          ⏰ {match.horaIsrael}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <Link href="/fixture">
                <a className="w-full mt-4 flex items-center justify-center bg-white text-river-black hover:bg-gray-100 font-bold py-2.5 rounded-xl transition-colors relative z-10 text-sm">
                  Fixture Completo
                </a>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ================= HISTORIA SECTION ================= */}
      <section id="historia" className="py-24 bg-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[500px] bg-diagonal-red opacity-5 -skew-y-3 origin-top-left -z-10"></div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-river-black mb-4">El Más <span className="text-river-red">Grande</span></h2>
            <p className="text-lg text-gray-600">Un repaso por los momentos que forjaron nuestra gloriosa historia.</p>
          </div>

          <div className="relative border-l-4 border-river-red/20 ml-4 space-y-12 pl-8">
            {timeline?.map((item, index) => (
              <motion.div
                key={item.year}
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="relative"
              >
                <div className="absolute top-0 left-[-43px] w-6 h-6 rounded-full bg-river-red border-4 border-white shadow-md z-10"></div>

                <div className="bg-gray-50 p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <span className="font-display text-4xl font-bold text-river-red/20 block mb-2">{item.year}</span>
                  <h3 className="text-xl font-bold text-river-black mb-2">{item.title}</h3>
                  <p className="text-gray-600">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= VIDEOS SECTION ================= */}
      <section id="videos" className="py-24 bg-river-black text-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center mb-12">
            <div>
              <h2 className="text-4xl md:text-5xl font-display font-bold">Videos & <span className="text-river-red">Goles</span></h2>
              <p className="text-gray-400 mt-2 text-lg">Reviví las emociones más grandes.</p>
            </div>
            <a href="https://www.youtube.com/@RiverPlate" target="_blank" rel="noreferrer" className="mt-4 md:mt-0 flex items-center gap-2 text-gray-300 hover:text-white transition-colors">
              Canal Oficial <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Featured Video */}
            <div className="lg:col-span-2 rounded-2xl overflow-hidden shadow-2xl shadow-black border border-white/10 aspect-video">
              <iframe
                width="100%"
                height="100%"
                src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=0&controls=1&showinfo=1"
                title="River Plate Video"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full object-cover"
              ></iframe>
            </div>

            {/* Video Playlist links */}
            <div className="flex flex-col gap-4">
              {[
                { title: "La Final de Madrid Completa", image: "https://images.unsplash.com/photo-1574629810360-7efbc5ea002c?q=80&w=2000&auto=format&fit=crop", query: "River Boca Madrid 2018 final completa" },
                { title: "Mejores goles Era Gallardo", image: "https://images.unsplash.com/photo-1508344928928-7165b67de128?q=80&w=2070&auto=format&fit=crop", query: "Mejores goles Marcelo Gallardo River Plate" },
                { title: "Cantitos de la Hinchada", image: "https://images.unsplash.com/photo-1614632537190-23e4146777db?q=80&w=2000&auto=format&fit=crop", query: "River Plate hinchada canciones Monumental" },
                { title: "Resumen Último Partido", image: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?q=80&w=2070&auto=format&fit=crop", query: "River Plate resumen goles ultimo partido" },
              ].map((vid, i) => (
                <a
                  key={i}
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(vid.query)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-4 bg-white/5 rounded-xl p-3 hover:bg-white/10 transition-colors border border-transparent hover:border-white/20 group"
                >
                  <div className="relative w-24 h-16 rounded-md overflow-hidden shrink-0">
                    <img src={vid.image} alt={vid.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Play className="w-6 h-6 text-white opacity-80 group-hover:opacity-100 group-hover:text-river-red transition-colors" fill="currentColor" />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm line-clamp-2 group-hover:text-river-red transition-colors">{vid.title}</h4>
                    <span className="text-xs text-gray-400 mt-1 block">Ver en YouTube</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= FILIAL RAMAT GAN SECTION ================= */}
      <section id="filial" className="py-24 bg-gray-50 relative overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-[0.03]">
          <img
            src={`${import.meta.env.BASE_URL}images/ramat-gan-bg.png`}
            alt="Ramat Gan Background"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col lg:flex-row">

            {/* Info Side */}
            <div className="lg:w-5/12 bg-river-black text-white p-10 lg:p-16 flex flex-col justify-center relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-river-red rounded-full blur-[100px] opacity-40"></div>

              <div className="mb-8">
                <span className="bg-white/10 px-4 py-1.5 rounded-full text-sm font-semibold tracking-wider uppercase text-river-red border border-river-red/30">
                  Sede Oficial en Israel
                </span>
              </div>

              <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">
                Unite a la <br /> <span className="text-river-red">Familia Riverplatense</span>
              </h2>

              <p className="text-gray-300 text-lg mb-8">
                No importa qué tan lejos estemos del Monumental, la pasión nos une. Sumate a nuestra filial para ver los partidos, participar en eventos y sentirte como en casa.
              </p>

              <ul className="space-y-4 mb-10">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="text-river-red w-6 h-6 shrink-0" />
                  <span>Encuentros para ver todos los partidos</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="text-river-red w-6 h-6 shrink-0" />
                  <span>Asados y eventos para toda la familia</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="text-river-red w-6 h-6 shrink-0" />
                  <span>Contacto directo con el Club en Bs As</span>
                </li>
              </ul>

              <a
                href="https://chat.whatsapp.com/CVctijXuwxmEJMpU4jmFMv?mode=gi_t"
                target="_blank"
                rel="noreferrer"
                className="bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold py-4 px-6 rounded-xl text-center transition-all flex items-center justify-center gap-3 shadow-lg hover:-translate-y-1"
              >
                Unite al Grupo de WhatsApp
              </a>
            </div>

            {/* Form Side */}
            <div className="lg:w-7/12 p-10 lg:p-16">
              <h3 className="font-display text-3xl font-bold text-river-black mb-2">Dejanos tus datos</h3>
              <p className="text-gray-500 mb-8">Completá el formulario y nos pondremos en contacto para sumarte oficialmente.</p>

              {isSubmitSuccessful ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-green-50 border border-green-200 text-green-800 p-8 rounded-2xl text-center"
                >
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h4 className="text-2xl font-bold mb-2">¡Gracias por sumarte!</h4>
                  <p>Hemos recibido tus datos. Pronto te contactaremos.</p>
                  <Button
                    onClick={() => reset()}
                    variant="outline"
                    className="mt-6 border-green-500 text-green-700 hover:bg-green-100"
                  >
                    Enviar otro mensaje
                  </Button>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Nombre Completo</label>
                      <Input
                        {...register("name")}
                        placeholder="Ej: Enzo Francescoli"
                        className={errors.name ? "border-red-500 focus-visible:ring-red-500" : ""}
                      />
                      {errors.name && <span className="text-xs text-red-500">{errors.name.message}</span>}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Teléfono (WhatsApp)</label>
                      <Input
                        {...register("phone")}
                        placeholder="+972 50-XXX-XXXX"
                        className={errors.phone ? "border-red-500 focus-visible:ring-red-500" : ""}
                      />
                      {errors.phone && <span className="text-xs text-red-500">{errors.phone.message}</span>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Correo Electrónico</label>
                    <Input
                      type="email"
                      {...register("email")}
                      placeholder="tuemail@ejemplo.com"
                      className={errors.email ? "border-red-500 focus-visible:ring-red-500" : ""}
                    />
                    {errors.email && <span className="text-xs text-red-500">{errors.email.message}</span>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Mensaje o Ciudad de Residencia</label>
                    <Textarea
                      {...register("message")}
                      placeholder="Contanos desde dónde alentás..."
                      className={errors.message ? "border-red-500 focus-visible:ring-red-500" : ""}
                    />
                    {errors.message && <span className="text-xs text-red-500">{errors.message.message}</span>}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-14 text-lg bg-river-red hover:bg-river-red-hover"
                    disabled={submitContact.isPending}
                  >
                    {submitContact.isPending ? "Enviando..." : "Quiero unirme"}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ================= GALERIA SECTION ================= */}
      <section id="galeria" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-river-black mb-4">La <span className="text-river-red">Pasión</span> en Imágenes</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-2 row-span-2 overflow-hidden rounded-xl">
              <img src="https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=2000&auto=format&fit=crop" alt="Hinchada" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
            </div>
            <div className="overflow-hidden rounded-xl h-48 md:h-64">
              <img src="https://images.unsplash.com/photo-1508344928928-7165b67de128?q=80&w=2070&auto=format&fit=crop" alt="Pelota" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
            </div>
            <div className="overflow-hidden rounded-xl h-48 md:h-64">
              <img src="https://images.unsplash.com/photo-1556056504-5c7696c4c28d?q=80&w=2076&auto=format&fit=crop" alt="Luces" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
            </div>
            <div className="col-span-2 overflow-hidden rounded-xl h-48 md:h-64">
              <img src="https://images.unsplash.com/photo-1614632537190-23e4146777db?q=80&w=2000&auto=format&fit=crop" alt="Festejo" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
