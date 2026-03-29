import { motion } from "framer-motion";
import { Trophy, Star, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

interface Hito {
  year: string;
  title: string;
  description: string;
  detail?: string;
  destacado?: boolean;
  imagen?: string;
  copa?: string;
  emoji?: string;
}

const HITOS: Hito[] = [
  {
    year: "1901",
    title: "Fundación",
    description: "El 25 de mayo de 1901 nace el Club Atlético River Plate en el barrio de La Boca, tras la fusión de los clubes Santa Rosa y La Rosales.",
    detail: "Sus primeros colores fueron el blanco y negro. El nombre fue tomado de los muelles del Riachuelo donde sus fundadores trabajaban y soñaban con el fútbol.",
    imagen: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?q=80&w=800&auto=format&fit=crop",
    emoji: "⚓",
  },
  {
    year: "1908",
    title: "La Banda Diagonal Roja",
    description: "La camiseta con la banda roja diagonal se adopta en 1908, convirtiéndose en el símbolo eterno del club.",
    emoji: "🎽",
  },
  {
    year: "1923",
    title: "El Primer Título Profesional",
    description: "River conquista su primer campeonato oficial de la Asociación Amateur, dando inicio a una larga historia de títulos.",
    destacado: true,
    emoji: "🏆",
    copa: "Primera División",
  },
  {
    year: "1931",
    title: "La Era Profesional",
    description: "Con el comienzo del fútbol profesional en Argentina, River Plate se convierte en uno de los primeros campeones de la era profesional.",
    emoji: "⚽",
  },
  {
    year: "1938",
    title: "Nace El Monumental",
    description: "Inauguración del Estadio Antonio Vespucio Liberti en el barrio de Núñez. Con capacidad para 80.000 espectadores, el más grande de Sudamérica.",
    detail: "Hoy conocido como el Más Monumental, tiene capacidad para más de 84.000 personas y es el más grande de toda América.",
    destacado: true,
    imagen: "https://images.unsplash.com/photo-1574629810360-7efbc5ea002c?q=80&w=800&auto=format&fit=crop",
    emoji: "🏟️",
  },
  {
    year: "1941",
    title: "La Máquina",
    description: "River forma el equipo conocido como 'La Máquina', considerado el mejor conjunto de fútbol de la historia argentina: Pedernera, Moreno, Muñoz, Di Stéfano y Loustau.",
    detail: "La delantera más temida del mundo, adelantada cincuenta años a su época.",
    destacado: true,
    imagen: "https://images.unsplash.com/photo-1553778263-73a83bab9b0c?q=80&w=800&auto=format&fit=crop",
    emoji: "⚡",
  },
  {
    year: "1957",
    title: "Alfredo Di Stéfano: La Leyenda",
    description: "Alfredo Di Stéfano, formado en River Plate, se convierte en el mejor jugador del mundo en el Real Madrid, ganando 5 Copas de Europa consecutivas.",
    emoji: "⭐",
  },
  {
    year: "1975",
    title: "Campeonato Nacional",
    description: "River conquista el Campeonato Nacional con un plantel que incluía figuras que definirían la historia del club por décadas.",
    destacado: true,
    emoji: "🏆",
    copa: "Campeonato Nacional",
  },
  {
    year: "1986",
    title: "¡Campeones del Mundo! — Primera Copa Libertadores",
    description: "Bajo el 'Bambino' Veira, River conquista América venciendo al América de Cali, y luego al mundo al vencer al Steaua Bucarest en Tokio por la Copa Intercontinental.",
    detail: "Un equipo extraordinario conducido por Ramón Díaz, Antonio Alzamendi, Norberto 'Beto' Alonso y el arquero Ubaldo Fillol.",
    destacado: true,
    imagen: "https://images.unsplash.com/photo-1508344928928-7165b67de128?q=80&w=800&auto=format&fit=crop",
    emoji: "🌎",
    copa: "Copa Libertadores + Copa Intercontinental",
  },
  {
    year: "1996",
    title: "La Segunda Libertadores — La Era de Francescoli",
    description: "Un plantel de estrellas liderado por Enzo Francescoli 'El Príncipe' levanta la segunda Copa Libertadores. Marcelo Gallardo también era parte de ese equipo histórico.",
    detail: "Hernán Crespo, Marcelo Salas, Ariel Ortega 'El Burrito', Francescoli y el joven Gallardo. La final en el Monumental fue una marea roja y blanca.",
    destacado: true,
    imagen: "https://images.unsplash.com/photo-1626248801379-51a0748a5f96?q=80&w=800&auto=format&fit=crop",
    emoji: "🏆",
    copa: "Copa Libertadores",
  },
  {
    year: "1997",
    title: "Campeones del Mundo por Segunda Vez — Tokio",
    description: "River repite en Tokio y se corona campeón del mundo por segunda vez, venciendo al Borussia Dortmund de Alemania con gol de Marcelo Salas.",
    detail: "Una actuación gloriosa que quedó grabada en la memoria de toda una generación riverplatense.",
    destacado: true,
    imagen: "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?q=80&w=800&auto=format&fit=crop",
    emoji: "🌍",
    copa: "Copa Intercontinental",
  },
  {
    year: "2014",
    title: "Llega Gallardo",
    description: "Marcelo Gallardo asume como director técnico. Ninguno sabía que comenzaba la era más gloriosa de la historia del club.",
    detail: "Con apenas 38 años, El Muñeco regresó al club de su vida como entrenador.",
    imagen: "https://images.unsplash.com/photo-1571772996211-2f02c9727629?q=80&w=800&auto=format&fit=crop",
    emoji: "🤝",
  },
  {
    year: "2015",
    title: "La Tercera Libertadores — Bajo la Lluvia de Porto Alegre",
    description: "Bajo la lluvia torrencial en el Beira-Rio de Porto Alegre, River vence a Tigres de México. El llanto de Gallardo se volvió símbolo eterno.",
    detail: "Rodrigo Mora abrió el marcador. Teo Gutiérrez sentenció. Bajo el aguacero, River ganó su tercera Libertadores con valentía.",
    destacado: true,
    imagen: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?q=80&w=800&auto=format&fit=crop",
    emoji: "🌧️",
    copa: "Copa Libertadores",
  },
  {
    year: "2015",
    title: "Copa Sudamericana — La Final Soñada vs. Boca",
    description: "Mismo año, doble internacional histórico: River se consagra campeón de la Copa Sudamericana venciendo a Boca Juniors en una final que quedó para siempre.",
    detail: "Vencer a Boca en una final es el sueño de todo hincha de River. Eso fue exactamente lo que hizo Gallardo en 2015.",
    destacado: true,
    imagen: "https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?q=80&w=800&auto=format&fit=crop",
    emoji: "🏆",
    copa: "Copa Sudamericana",
  },
  {
    year: "2018",
    title: "La Gloria Eterna en Madrid — vs. Boca, en el Bernabéu",
    description: "El 9 de diciembre, River vence a su eterno rival Boca Juniors 3-1 en el Santiago Bernabéu, conquistando la cuarta Copa Libertadores, la más emocionante de la historia.",
    detail: "Marcos Acuña, Rafael Santos Borré (x2) y el descuento de Villa. El mundo fue rojo y blanco aquella noche en Madrid.",
    destacado: true,
    imagen: "https://images.unsplash.com/photo-1614632537190-23e4146777db?q=80&w=800&auto=format&fit=crop",
    emoji: "👑",
    copa: "Copa Libertadores",
  },
  {
    year: "2019",
    title: "Recopa Sudamericana — Otra vez vs. Boca",
    description: "River vence nuevamente a Boca y suma otro título internacional, consolidando a Gallardo como el DT más exitoso de la historia del club.",
    destacado: true,
    emoji: "🏆",
    copa: "Recopa Sudamericana",
  },
  {
    year: "2021",
    title: "El Más Monumental — Remodelación Completa",
    description: "Finaliza la remodelación total del estadio. Con 84.567 localidades, se convierte en el estadio más grande de América y uno de los más modernos del mundo.",
    destacado: true,
    imagen: "https://images.unsplash.com/photo-1574629810360-7efbc5ea002c?q=80&w=800&auto=format&fit=crop",
    emoji: "🏗️",
  },
  {
    year: "2023",
    title: "Campeón de la Liga Profesional",
    description: "River se consagra campeón de la Liga Profesional Argentina bajo la conducción de Martín Demichelis, con juego atractivo y un plantel que fusionó experiencia y juventud.",
    destacado: true,
    emoji: "🏆",
    copa: "Liga Profesional",
  },
  {
    year: "2024",
    title: "Regresa Gallardo",
    description: "Marcelo Gallardo regresa al banquillo de River Plate. Su retorno emocionó a millones de hinchas en todo el mundo, incluida nuestra Filial Ramat Gan.",
    destacado: true,
    imagen: "https://images.unsplash.com/photo-1571772996211-2f02c9727629?q=80&w=800&auto=format&fit=crop",
    emoji: "❤️",
  },
  {
    year: "2026",
    title: "Eduardo Coudet — El Nuevo Ciclo",
    description: "Eduardo 'Chacho' Coudet asume como DT con la misión de continuar la grandeza del club en los máximos torneos internacionales.",
    detail: "Con amplia experiencia en el fútbol europeo y sudamericano, Coudet inicia una nueva etapa. Desde Israel, la Filial Ramat Gan sigue cada partido con la misma pasión.",
    imagen: "/images/coudet.jpeg",
    emoji: "🔴",
  },
];

const ERAS = [
  { nombre: "Los Orígenes",       yearRange: "1901 – 1937", scrollTo: "1901", color: "bg-gray-500" },
  { nombre: "La Edad Dorada",     yearRange: "1938 – 1985", scrollTo: "1938", color: "bg-amber-500" },
  { nombre: "Campeones del Mundo", yearRange: "1986 – 2013", scrollTo: "1986", color: "bg-river-red" },
  { nombre: "Era Gallardo I",     yearRange: "2014 – 2022", scrollTo: "2014", color: "bg-red-700" },
  { nombre: "Era Demichelis",     yearRange: "2023 – 2024", scrollTo: "2023", color: "bg-orange-600" },
  { nombre: "Era Gallardo II",    yearRange: "2024 – 2026", scrollTo: "2024", color: "bg-red-700" },
  { nombre: "Era Coudet",         yearRange: "2026 – Presente", scrollTo: "2026", color: "bg-red-400" },
];

const TITULOS = [
  { cantidad: "38", nombre: "Primera División", emoji: "🏆" },
  { cantidad: "4",  nombre: "Copas Libertadores", emoji: "🌎" },
  { cantidad: "2",  nombre: "Copas Intercontinentales", emoji: "🌍" },
  { cantidad: "1",  nombre: "Copa Sudamericana", emoji: "🏅" },
  { cantidad: "3",  nombre: "Copas Argentina", emoji: "🇦🇷" },
  { cantidad: "3",  nombre: "Súper Copa Argentina", emoji: "⭐" },
  { cantidad: "2",  nombre: "Trofeo de Campeones", emoji: "🎖️" },
];

function getEraStyle(year: string): { border: string; bg: string; yearColor: string; dotColor: string; badgeBg: string } {
  const y = parseInt(year);
  if (y <= 1937) return { border: "border-l-gray-400",   bg: "bg-gray-50",      yearColor: "text-gray-500",  dotColor: "bg-gray-400",   badgeBg: "bg-gray-100 text-gray-600" };
  if (y <= 1985) return { border: "border-l-amber-400",  bg: "bg-amber-50",     yearColor: "text-amber-600", dotColor: "bg-amber-500",  badgeBg: "bg-amber-100 text-amber-700" };
  if (y <= 2013) return { border: "border-l-red-500",    bg: "bg-red-50",       yearColor: "text-red-600",   dotColor: "bg-red-500",    badgeBg: "bg-red-100 text-red-700" };
  if (y <= 2022) return { border: "border-l-red-700",    bg: "bg-red-50",       yearColor: "text-red-700",   dotColor: "bg-red-700",    badgeBg: "bg-red-200 text-red-800" };
  if (y <= 2024) return { border: "border-l-orange-500", bg: "bg-orange-50",    yearColor: "text-orange-600",dotColor: "bg-orange-500", badgeBg: "bg-orange-100 text-orange-700" };
  return           { border: "border-l-rose-400",   bg: "bg-rose-50",      yearColor: "text-rose-500",  dotColor: "bg-rose-400",   badgeBg: "bg-rose-100 text-rose-600" };
}

function HitoCard({ hito, index }: { hito: Hito; index: number }) {
  const s = getEraStyle(hito.year);
  return (
    <motion.div
      key={`${hito.year}-${index}`}
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.03, 0.3) }}
      className="flex gap-4 group"
    >
      {/* Línea + dot */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-5 h-5 rounded-full border-4 border-white shadow-md flex-shrink-0 mt-1 transition-transform group-hover:scale-125 z-10 ${hito.destacado ? s.dotColor : "bg-gray-300"}`} />
        <div className="w-0.5 flex-1 mt-1 bg-gradient-to-b from-gray-200 to-transparent" />
      </div>

      {/* Tarjeta */}
      <div className={`flex-1 mb-6 rounded-2xl border-l-4 overflow-hidden shadow-sm hover:shadow-lg transition-all ${s.border} ${s.bg}`}>
        {/* Header */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              {hito.emoji && <span className="text-2xl leading-none">{hito.emoji}</span>}
              <span className={`font-display text-3xl font-bold leading-none ${s.yearColor}`}>{hito.year}</span>
            </div>
            {hito.copa && (
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0 ${s.badgeBg}`}>
                {hito.copa}
              </span>
            )}
          </div>
          <h3 className="font-bold text-river-black text-base leading-snug mb-1.5 flex items-center gap-1.5">
            {hito.destacado && <Trophy className="w-4 h-4 text-river-red shrink-0" />}
            {hito.title}
          </h3>
          <p className="text-gray-600 text-sm leading-relaxed">{hito.description}</p>
          {hito.detail && (
            <p className="text-gray-400 text-xs leading-relaxed mt-2 italic border-t border-gray-200/60 pt-2">{hito.detail}</p>
          )}
        </div>

        {/* Imagen */}
        {hito.imagen && (
          <div className="relative h-40 overflow-hidden">
            <img
              src={hito.imagen}
              alt={hito.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function Historia() {
  const { data: apiData } = useQuery<{ hitos: Hito[] }>({
    queryKey: ["historia"],
    queryFn: async () => {
      const res = await fetch("/api/historia");
      if (!res.ok) throw new Error("Error");
      return res.json() as Promise<{ hitos: Hito[] }>;
    },
  });
  const hitos = apiData?.hitos ?? HITOS;

  const scrollToEra = (year: string) => {
    const el = document.getElementById(`era-${year}`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <div className="w-full bg-white">

      {/* ── HERO ── */}
      <section className="relative bg-river-black text-white overflow-hidden py-28">
        <div className="absolute inset-0 z-0 opacity-20">
          <img
            src="https://images.unsplash.com/photo-1614632537190-23e4146777db?q=80&w=2000&auto=format&fit=crop"
            alt="Monumental"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-river-black via-river-black/80 to-transparent" />
        </div>
        <div className="absolute top-0 left-0 w-full h-1 bg-river-red" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" animate="show" variants={fadeUp}>
            <span className="bg-river-red/20 border border-river-red/30 text-river-red text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6 inline-block">
              Club Atlético River Plate · Desde 1901
            </span>
            <h1 className="text-5xl md:text-7xl font-display font-bold mb-6 leading-none">
              Historia <br />
              <span className="text-river-red">del Más Grande</span>
            </h1>
            <p className="text-gray-300 text-xl max-w-2xl leading-relaxed">
              Más de 120 años de gloria, goles y pasión.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── PALMARÉS ── */}
      <section className="bg-river-red text-white py-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-4 md:grid-cols-7 gap-4 text-center">
            {TITULOS.map((t) => (
              <div key={t.nombre} className="space-y-1">
                <div className="text-2xl mb-0.5">{t.emoji}</div>
                <div className="text-3xl md:text-4xl font-display font-bold">{t.cantidad}</div>
                <div className="text-[10px] text-white/70 uppercase tracking-wider leading-tight">{t.nombre}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FILTRO POR ERA ── */}
      <section className="sticky top-[64px] z-30 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm py-3">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
            {ERAS.map((era) => (
              <button
                key={era.nombre}
                onClick={() => scrollToEra(era.scrollTo)}
                className={`flex-none text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full text-white transition-all hover:scale-105 ${era.color}`}
              >
                {era.nombre}
                <span className="ml-1 opacity-60 font-normal normal-case">{era.yearRange}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── LÍNEA DEL TIEMPO VERTICAL ── */}
      <section className="py-12 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="mb-10 text-center">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-river-black">
              La Historia <span className="text-river-red">Año a Año</span>
            </h2>
            <p className="text-gray-400 mt-2 text-sm">Desde la fundación hasta hoy — cada hito que nos hizo el club más grande de Argentina.</p>
          </div>

          {/* Timeline */}
          <div>
            {ERAS.map((era) => {
              const hitosEra = hitos.filter(h => {
                const y = parseInt(h.year);
                const eraIdx = ERAS.indexOf(era);
                const nextEra = ERAS[eraIdx + 1];
                const from = parseInt(era.scrollTo);
                const to = nextEra ? parseInt(nextEra.scrollTo) - 1 : 9999;
                return y >= from && y <= to;
              });
              if (hitosEra.length === 0) return null;
              return (
                <div key={era.nombre} id={`era-${era.scrollTo}`}>
                  {/* Separador de era */}
                  <div className="flex items-center gap-3 mb-6 mt-10 first:mt-0">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${era.color}`} />
                    <div className="flex-1 h-px bg-gray-200" />
                    <div>
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full text-white ${era.color}`}>
                        {era.nombre} · {era.yearRange}
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>

                  {hitosEra.map((hito, i) => (
                    <HitoCard key={`${hito.year}-${i}`} hito={hito} index={i} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA FILIAL ── */}
      <section className="py-16 bg-river-black text-white text-center">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-5xl mb-4">🇮🇱 ❤️</div>
          <h2 className="font-display text-3xl font-bold mb-3">
            Viví la historia desde Israel
          </h2>
          <p className="text-gray-400 mb-8">
            Cada partido, cada copa, cada gloria — la seguimos juntos desde Ramat Gan. Sumate a la familia riverplatense en Israel.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-river-red hover:bg-river-red/85 text-white font-bold py-3 px-8 rounded-xl transition-colors"
          >
            Conocé la Filial <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

    </div>
  );
}
