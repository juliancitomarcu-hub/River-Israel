import { motion } from "framer-motion";
import { Trophy, Calendar, Award } from "lucide-react";
import { useHistoryTimeline } from "@/hooks/use-river-data";
import { Link } from "wouter";

export default function Historia() {
  const { data: timeline, isLoading } = useHistoryTimeline();

  const fadeIn = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] newspaper-texture pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-16 pb-8 border-b-4 border-tinta">
          <Link href="/">
            <span className="inline-block text-xs text-gris-meta hover:text-river-red font-bold uppercase tracking-wider mb-4 cursor-pointer transition-colors">
              ← Volver a la portada
            </span>
          </Link>
          <h1 className="font-display text-5xl md:text-7xl text-tinta mb-4">
            HISTORIA DE RIVER
          </h1>
          <p className="text-gris-meta text-lg max-w-2xl mx-auto leading-relaxed">
            Desde La Boca hasta el mundo entero — más de 120 años de gloria, pasión y leyenda millonaria.
          </p>
        </div>

        {/* Hero visual */}
        <div className="relative h-[400px] mb-16 overflow-hidden border-4 border-tinta">
          <img
            src={`${import.meta.env.BASE_URL}images/estadio-river.jpeg`}
            alt="Estadio Monumental"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-tinta/80 via-tinta/20 to-transparent flex items-end p-8">
            <div>
              <p className="font-display text-4xl text-white mb-2">EL MÁS MONUMENTAL</p>
              <p className="text-white/80 text-sm font-mono">
                Casa del Millonario desde 1938 — testigo de la historia más gloriosa del fútbol argentino.
              </p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-river-red border-t-transparent rounded-full animate-spin" />
              <p className="text-gris-meta font-bold font-display text-xl">CARGANDO HISTORIA...</p>
            </div>
          </div>
        ) : (
          <div className="relative">
            {/* Línea vertical */}
            <div className="absolute left-8 top-0 bottom-0 w-1 bg-gris-borde"></div>

            <div className="space-y-12">
              {timeline?.map((evento, i) => (
                <motion.article
                  key={i}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: "-60px" }}
                  variants={fadeIn}
                  transition={{ delay: i * 0.1 }}
                  className="relative pl-20"
                >
                  {/* Año en círculo */}
                  <div className="absolute left-0 top-0 w-16 h-16 bg-river-red border-4 border-white flex items-center justify-center shadow-lg">
                    <span className="font-display text-white text-lg font-bold">
                      {evento.year}
                    </span>
                  </div>

                  {/* Contenido */}
                  <div className="bg-white border-2 border-gris-borde hover:border-river-red transition-all p-6 hover:shadow-lg">
                    <div className="flex items-start gap-3 mb-3">
                      <Trophy className="w-6 h-6 text-river-red flex-shrink-0 mt-1" />
                      <h3 className="font-display text-2xl text-tinta leading-tight">
                        {evento.title}
                      </h3>
                    </div>
                    <p className="text-tinta leading-relaxed">
                      {evento.description}
                    </p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        )}

        {/* Palmarés destacado */}
        <div className="mt-20 pt-12 border-t-4 border-tinta">
          <h2 className="font-display text-4xl text-tinta text-center mb-8">
            TÍTULOS PRINCIPALES
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={fadeIn}
              className="bg-white border-2 border-gris-borde p-6 text-center hover:border-river-red transition-all hover:shadow-lg"
            >
              <Trophy className="w-12 h-12 text-river-red mx-auto mb-3" />
              <p className="font-display text-5xl text-tinta mb-2">4</p>
              <p className="text-sm font-bold text-gris-meta uppercase tracking-wider">Copas Libertadores</p>
            </motion.div>
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={fadeIn}
              transition={{ delay: 0.1 }}
              className="bg-white border-2 border-gris-borde p-6 text-center hover:border-river-red transition-all hover:shadow-lg"
            >
              <Award className="w-12 h-12 text-river-red mx-auto mb-3" />
              <p className="font-display text-5xl text-tinta mb-2">1</p>
              <p className="text-sm font-bold text-gris-meta uppercase tracking-wider">Copa Intercontinental</p>
            </motion.div>
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={fadeIn}
              transition={{ delay: 0.2 }}
              className="bg-white border-2 border-gris-borde p-6 text-center hover:border-river-red transition-all hover:shadow-lg"
            >
              <Calendar className="w-12 h-12 text-river-red mx-auto mb-3" />
              <p className="font-display text-5xl text-tinta mb-2">38</p>
              <p className="text-sm font-bold text-gris-meta uppercase tracking-wider">Campeonatos Locales</p>
            </motion.div>
          </div>
        </div>

        {/* CTA final */}
        <div className="mt-16 bg-tinta border-4 border-river-red p-8 text-center text-white">
          <p className="font-display text-3xl mb-2">VIVÍ LA HISTORIA CON NOSOTROS</p>
          <p className="text-white/80 mb-6">
            Somos parte de la misma leyenda millonaria, desde Ramat Gan hasta el Monumental.
          </p>
          <Link href="/">
            <button className="inline-block bg-river-red hover:bg-river-red-hover text-white font-bold px-8 py-3 transition-colors uppercase tracking-wide">
              Volver a la portada
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
