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
}

const HITOS: Hito[] = [
  {
    year: "1901",
    title: "Fundación",
    description: "El 25 de mayo de 1901 nace el Club Atlético River Plate en el barrio de La Boca, tras la fusión de los clubes Santa Rosa y La Rosales.",
    detail: "Sus primeros colores fueron el blanco y negro. El nombre fue tomado de los muelles del Riachuelo donde sus fundadores, mayoritariamente inmigrantes ingleses e italianos, trabajaban y soñaban con el fútbol.",
    imagen: "https://images.unsplash.com/photo-1518605368461-1e122c4cdce0?q=80&w=800&auto=format&fit=crop",
  },
  {
    year: "1908",
    title: "Ascenso a Primera División",
    description: "River Plate asciende a la Primera División de la Asociación Amateur de Football, comenzando su historia en el máximo nivel del fútbol argentino.",
    detail: "La camiseta con la banda roja diagonal se adopta en 1908, convirtiéndose en el símbolo distintivo que el club llevaría para siempre.",
  },
  {
    year: "1923",
    title: "El Primer Título Profesional",
    description: "River conquista su primer campeonato oficial de la Asociación Amateur, dando inicio a una larga historia de títulos que lo convertiría en el club más laureado de Argentina.",
    detail: "Con este primer campeonato, River dejó en claro que había llegado para quedarse en la élite del fútbol argentino.",
  },
  {
    year: "1931",
    title: "La Era Profesional",
    description: "Con el comienzo del fútbol profesional en Argentina, River Plate se convierte en uno de los primeros campeones de la era profesional, adaptándose rápidamente al nuevo sistema competitivo.",
    detail: "La profesionalización del fútbol argentino representó una revolución total. River fue uno de los primeros en capitalizarlo.",
  },
  {
    year: "1938",
    title: "Nace El Monumental",
    description: "Inauguración del Estadio Antonio Vespucio Liberti en el barrio de Núñez. Con capacidad inicial para 80.000 espectadores, se convierte en el más grande de Sudamérica.",
    detail: "Hoy conocido como el Más Monumental tras su remodelación completa terminada en 2022, el estadio tiene capacidad para más de 84.000 personas y es el más grande de toda América.",
    destacado: true,
    imagen: "https://images.unsplash.com/photo-1574629810360-7efbc5ea002c?q=80&w=800&auto=format&fit=crop",
  },
  {
    year: "1941",
    title: "La Máquina",
    description: "River forma el equipo conocido como 'La Máquina', considerado el mejor conjunto de fútbol de la historia argentina, con Pedernera, Moreno, Muñoz, Di Stéfano y Loustau.",
    detail: "Adolfo Pedernera, José Manuel Moreno, Ángel Labruna, Félix Loustau y Juan Carlos Muñoz — luego se sumaría el joven Alfredo Di Stéfano — formaron la delantera más temida del mundo. Ganaban con una facilidad pasmosa y su estilo de juego era adelantado cincuenta años a su época.",
    destacado: true,
  },
  {
    year: "1957",
    title: "Alfredo Di Stéfano: La Leyenda Que Se Fue",
    description: "Alfredo Di Stéfano, formado en River Plate, se convierte en el mejor jugador del mundo en el Real Madrid, siendo la primera gran figura global surgida de las divisiones inferiores riverplatenses.",
    detail: "Di Stéfano ganó 5 Copas de Europa consecutivas con el Real Madrid. Su partida fue un golpe, pero su legado en River quedó intacto para siempre.",
  },
  {
    year: "1975",
    title: "El Campeonato Nacional con el 'Muñeco'",
    description: "River conquista el Campeonato Nacional con un equipo donde comenzaba a despuntar el joven Marcelo Gallardo, quien décadas más tarde regresaría como el DT más ganador de la historia del club.",
    detail: "Este campeonato fue especialmente valorado ya que se trató de una competencia de carácter nacional, en la que participaron equipos del interior del país.",
  },
  {
    year: "1986",
    title: "Primera Copa Libertadores",
    description: "Bajo la conducción técnica del 'Bambino' Veira, River Plate conquista América y luego el mundo al vencer al Steaua Bucarest de Rumania en Tokio por la Copa Intercontinental.",
    detail: "Un equipo extraordinario conducido por Ramón Díaz, Antonio Alzamendi, Norberto Alonso 'Beto' y el arquero Ubaldo Fillol. El título en Tokio marcó el primer reconocimiento mundial de River Plate.",
    destacado: true,
    imagen: "https://images.unsplash.com/photo-1508344928928-7165b67de128?q=80&w=800&auto=format&fit=crop",
  },
  {
    year: "1996",
    title: "La Segunda Libertadores",
    description: "Un equipo plagado de estrellas liderado por Enzo Francescoli levanta la segunda Copa Libertadores. Marcelo Gallardo también era parte de ese plantel histórico.",
    detail: "Hernán Crespo, Marcelo Salas 'El Matador', Ariel Ortega 'El Burrito', Enzo Francescoli 'El Príncipe' y el joven Marcelo Gallardo. Un equipo que enloqueció al mundo. La final se jugó en el Monumental ante una marea humana vestida de rojo y blanco.",
    destacado: true,
  },
  {
    year: "1997",
    title: "Copa Intercontinental en Tokio",
    description: "River repite en Tokio y se corona campeón del mundo por segunda vez, venciendo al Borussia Dortmund de Alemania, reafirmando su jerarquía a nivel global.",
    detail: "Con gol de Salas, River se consagró ante el campeón europeo. Una actuación gloriosa que quedó grabada en la memoria de toda una generación.",
    destacado: true,
  },
  {
    year: "2014",
    title: "Llega Gallardo",
    description: "Marcelo Gallardo asume como director técnico de River Plate. Ninguno sabía que comenzaba la era más gloriosa de la historia del club.",
    detail: "Con apenas 38 años, Marcelo 'El Muñeco' Gallardo regresó al club de su vida como entrenador. Lo que siguió fue una saga de títulos que no tuvo precedentes.",
  },
  {
    year: "2015",
    title: "La Tercera: Bajo la Lluvia",
    description: "Bajo la lluvia torrencial en el Estadio Beira-Rio de Porto Alegre, River vence a Tigres de México y conquista la tercera Copa Libertadores. El llanto de Gallardo se volvió símbolo.",
    detail: "Rodrigo Mora abrió el marcador. Teo Gutiérrez sentenció. Bajo el aguacero de Porto Alegre, River ganó su tercera Libertadores con un equipo compacto, valiente y completamente identificado con la filosofía del Muñeco.",
    destacado: true,
    imagen: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?q=80&w=800&auto=format&fit=crop",
  },
  {
    year: "2015",
    title: "Copa Sudamericana",
    description: "Mismo año, double internacional: River se consagra también campeón de la Copa Sudamericana, venciendo a Boca Juniors en una final histórica.",
    detail: "Vencer a Boca en una final es el sueño de todo hincha de River. Eso fue exactamente lo que hizo Gallardo en 2015. Esa copa quedó guardada en el corazón riverplatense para siempre.",
    destacado: true,
  },
  {
    year: "2018",
    title: "La Gloria Eterna en Madrid",
    description: "El 9 de diciembre de 2018, River Plate vence a su eterno rival Boca Juniors 3-1 en el Santiago Bernabéu, conquistando la cuarta Libertadores y la más importante de la historia.",
    detail: "Una final sin precedentes en territorio europeo. Después de que el primer partido en el Monumental fuera suspendido por el ataque al micro de River, la FIFA decidió jugar la revancha en España. Marcos Acuña, Rafael Santos Borré (x2) y el descuento de Villa. El mundo fue rojo y blanco aquella noche en Madrid.",
    destacado: true,
    imagen: "https://images.unsplash.com/photo-1614632537190-23e4146777db?q=80&w=800&auto=format&fit=crop",
  },
  {
    year: "2019",
    title: "Recopa Sudamericana",
    description: "River vence nuevamente a Boca y suma otro título internacional, consolidando a Gallardo como el DT más exitoso de la historia del club en torneos internacionales.",
    detail: "Con este título, Gallardo igualaba y superaba récords históricos. La era de El Muñeco seguía asombrando a propios y extraños.",
  },
  {
    year: "2021",
    title: "El Más Monumental: Remodelación Completa",
    description: "Finaliza la remodelación del estadio Monumental, que pasa a llamarse 'El Más Monumental'. Con 84.567 localidades, se convierte en el estadio más grande de América y uno de los más modernos del mundo.",
    detail: "La obra fue un símbolo del crecimiento institucional del club. Tecnología de punta, pantallas gigantes, nueva cubierta y una arquitectura que lo convirtió en un destino turístico de Buenos Aires.",
    destacado: true,
  },
  {
    year: "2023",
    title: "Campeón de la Liga Profesional",
    description: "River se consagra campeón de la Liga Profesional Argentina bajo la conducción de Martín Demichelis, sumando un nuevo título a su palmarés en el fútbol local.",
    detail: "Con Demichelis en el banco, River volvió a la cima del fútbol argentino con un juego atractivo y un plantel competitivo que fusionó experiencia y juventud.",
  },
  {
    year: "2024",
    title: "Regresa Gallardo",
    description: "Marcelo Gallardo regresa al banquillo de River Plate en un retorno que emocionó a miles de hinchas en todo el mundo, incluida nuestra Filial Ramat Gan en Israel.",
    detail: "El regreso del Muñeco fue uno de los momentos más esperados por la hinchada. Con la ilusión renovada, River volvió a depositar su confianza en el entrenador más exitoso de su historia.",
    destacado: true,
  },
  {
    year: "2025",
    title: "Eduardo Coudet, el nuevo ciclo",
    description: "Eduardo 'Chacho' Coudet asume como Director Técnico de River Plate, con la misión de continuar la grandeza del club y volver a pelear los máximos torneos internacionales.",
    detail: "Con amplia experiencia en el fútbol europeo y sudamericano, Coudet inició una nueva etapa para River. Desde Israel, la Filial Ramat Gan sigue cada partido con la misma pasión de siempre.",
    imagen: "/images/coudet.jpeg",
  },
];

const ERAS = [
  { nombre: "Los Orígenes", yearRange: "1901 – 1937", color: "bg-gray-100 text-gray-700" },
  { nombre: "La Edad Dorada", yearRange: "1938 – 1985", color: "bg-amber-50 text-amber-700" },
  { nombre: "Campeones del Mundo", yearRange: "1986 – 2013", color: "bg-red-50 text-red-700" },
  { nombre: "La Era Gallardo", yearRange: "2014 – Presente", color: "bg-river-red text-white" },
];

const TITULOS = [
  { cantidad: "37", nombre: "Campeonatos Locales" },
  { cantidad: "4", nombre: "Copas Libertadores" },
  { cantidad: "2", nombre: "Copas Intercontinentales" },
  { cantidad: "1", nombre: "Copa Sudamericana" },
  { cantidad: "3", nombre: "Recopas" },
  { cantidad: "1", nombre: "Copa de Honor" },
];

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
              Más de 120 años de gloria, pasión y grandeza. Un club que nació en La Boca, creció en Núñez y conquistó el mundo.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── PALMARÉS ── */}
      <section className="bg-river-red text-white py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center">
            {TITULOS.map((t) => (
              <div key={t.nombre} className="space-y-1">
                <div className="text-3xl md:text-4xl font-display font-bold">{t.cantidad}</div>
                <div className="text-xs text-white/70 uppercase tracking-wider leading-tight">{t.nombre}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ERAS ── */}
      <section className="py-12 bg-gray-50 border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-3 justify-center">
            {ERAS.map((era) => (
              <div key={era.nombre} className={`px-5 py-2 rounded-full text-sm font-bold ${era.color}`}>
                {era.nombre} · <span className="font-normal opacity-80">{era.yearRange}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TIMELINE COMPLETO ── */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center mb-14">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-river-black mb-3">
              Cronología <span className="text-river-red">Completa</span>
            </h2>
            <p className="text-gray-500 text-lg">Los hitos que escribieron la leyenda del Millonario</p>
          </div>

          <div className="relative border-l-4 border-river-red/20 ml-4 space-y-8 pl-8">
            {HITOS.map((hito, index) => (
              <motion.div
                key={`${hito.year}-${index}`}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-80px" }}
                variants={fadeUp}
                className="relative"
              >
                {/* Dot */}
                <div className={`absolute top-4 left-[-43px] w-6 h-6 rounded-full border-4 border-white shadow-md z-10 ${hito.destacado ? "bg-river-red" : "bg-gray-400"}`} />

                <div className={`rounded-2xl border overflow-hidden transition-shadow hover:shadow-lg ${hito.destacado ? "border-river-red/20 shadow-md" : "border-gray-100 shadow-sm"}`}>
                  {/* Imagen opcional */}
                  {hito.imagen && (
                    <div className="h-40 overflow-hidden">
                      <img src={hito.imagen} alt={hito.title} className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className={`p-5 ${hito.destacado ? "bg-red-50/50" : "bg-gray-50"}`}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <span className={`font-display text-3xl font-bold block leading-none mb-1 ${hito.destacado ? "text-river-red" : "text-river-red/25"}`}>
                          {hito.year}
                        </span>
                        <h3 className="text-lg font-bold text-river-black flex items-center gap-2">
                          {hito.destacado && <Trophy className="w-4 h-4 text-river-red shrink-0" />}
                          {hito.title}
                        </h3>
                      </div>
                      {hito.destacado && (
                        <Star className="w-5 h-5 text-river-red/60 shrink-0 mt-1" fill="currentColor" />
                      )}
                    </div>

                    <p className="text-gray-600 text-sm mb-2">{hito.description}</p>

                    {hito.detail && (
                      <p className="text-gray-500 text-sm leading-relaxed border-t border-gray-200/70 pt-3 mt-3">
                        {hito.detail}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
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
