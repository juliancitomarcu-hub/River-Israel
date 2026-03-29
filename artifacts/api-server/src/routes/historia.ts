import { Router, type IRouter } from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const router: IRouter = Router();

const DATA_DIR = join(process.cwd(), "data");
const HISTORIA_FILE = join(DATA_DIR, "historia.json");

interface HitoItem {
  year: string;
  title: string;
  description: string;
  detail?: string;
  destacado?: boolean;
  imagenPortada?: string;
}

const HITOS_DEFAULT: HitoItem[] = [
  { year: "1901", title: "Fundación", description: "El 25 de mayo de 1901 nace el Club Atlético River Plate en el barrio de La Boca, tras la fusión de los clubes Santa Rosa y La Rosales.", detail: "Sus primeros colores fueron el blanco y negro. El nombre fue tomado de los muelles del Riachuelo donde sus fundadores, mayoritariamente inmigrantes ingleses e italianos, trabajaban y soñaban con el fútbol." },
  { year: "1908", title: "Ascenso a Primera División", description: "River Plate asciende a la Primera División de la Asociación Amateur de Football, comenzando su historia en el máximo nivel del fútbol argentino.", detail: "La camiseta con la banda roja diagonal se adopta en 1908, convirtiéndose en el símbolo distintivo que el club llevaría para siempre." },
  { year: "1923", title: "El Primer Título Profesional", description: "River conquista su primer campeonato oficial de la Asociación Amateur, dando inicio a una larga historia de títulos.", detail: "Con este primer campeonato, River dejó en claro que había llegado para quedarse en la élite del fútbol argentino." },
  { year: "1931", title: "La Era Profesional", description: "Con el comienzo del fútbol profesional en Argentina, River Plate se convierte en uno de los primeros campeones de la era profesional.", detail: "La profesionalización del fútbol argentino representó una revolución total. River fue uno de los primeros en capitalizarlo." },
  { year: "1938", title: "Nace El Monumental", description: "Inauguración del Estadio Antonio Vespucio Liberti en el barrio de Núñez. Con capacidad inicial para 80.000 espectadores, se convierte en el más grande de Sudamérica.", detail: "Hoy conocido como el Más Monumental tras su remodelación completa terminada en 2022, el estadio tiene capacidad para más de 84.000 personas y es el más grande de toda América.", destacado: true },
  { year: "1941", title: "La Máquina", description: "River forma el equipo conocido como 'La Máquina', considerado el mejor conjunto de fútbol de la historia argentina, con Pedernera, Moreno, Muñoz, Di Stéfano y Loustau.", detail: "Adolfo Pedernera, José Manuel Moreno, Ángel Labruna, Félix Loustau y Juan Carlos Muñoz formaron la delantera más temida del mundo.", destacado: true },
  { year: "1957", title: "Alfredo Di Stéfano: La Leyenda Que Se Fue", description: "Alfredo Di Stéfano, formado en River Plate, se convierte en el mejor jugador del mundo en el Real Madrid.", detail: "Di Stéfano ganó 5 Copas de Europa consecutivas con el Real Madrid. Su legado en River quedó intacto para siempre." },
  { year: "1975", title: "El Campeonato Nacional", description: "River conquista el Campeonato Nacional con un equipo donde comenzaba a despuntar el joven Marcelo Gallardo.", detail: "Este campeonato fue especialmente valorado ya que se trató de una competencia de carácter nacional." },
  { year: "1986", title: "Primera Copa Libertadores", description: "Bajo la conducción técnica del 'Bambino' Veira, River Plate conquista América y luego el mundo al vencer al Steaua Bucarest en Tokio por la Copa Intercontinental.", detail: "Un equipo extraordinario conducido por Ramón Díaz, Antonio Alzamendi, Norberto Alonso y el arquero Ubaldo Fillol.", destacado: true },
  { year: "1996", title: "La Segunda Libertadores", description: "Un equipo plagado de estrellas liderado por Enzo Francescoli levanta la segunda Copa Libertadores.", detail: "Hernán Crespo, Marcelo Salas, Ariel Ortega, Enzo Francescoli y el joven Marcelo Gallardo. Un equipo que enloqueció al mundo.", destacado: true },
  { year: "1997", title: "Copa Intercontinental en Tokio", description: "River repite en Tokio y se corona campeón del mundo por segunda vez, venciendo al Borussia Dortmund de Alemania.", detail: "Con gol de Salas, River se consagró ante el campeón europeo.", destacado: true },
  { year: "2014", title: "Llega Gallardo", description: "Marcelo Gallardo asume como director técnico de River Plate. Ninguno sabía que comenzaba la era más gloriosa de la historia del club.", detail: "Con apenas 38 años, Marcelo 'El Muñeco' Gallardo regresó al club de su vida como entrenador." },
  { year: "2015", title: "La Tercera: Bajo la Lluvia", description: "Bajo la lluvia torrencial en Porto Alegre, River vence a Tigres de México y conquista la tercera Copa Libertadores.", detail: "Rodrigo Mora abrió el marcador. Teo Gutiérrez sentenció. Bajo el aguacero de Porto Alegre, River ganó su tercera Libertadores.", destacado: true },
  { year: "2015", title: "Copa Sudamericana", description: "Mismo año, double internacional: River se consagra también campeón de la Copa Sudamericana, venciendo a Boca Juniors en una final histórica.", detail: "Vencer a Boca en una final es el sueño de todo hincha de River. Eso fue exactamente lo que hizo Gallardo en 2015.", destacado: true },
  { year: "2018", title: "La Gloria Eterna en Madrid", description: "El 9 de diciembre de 2018, River Plate vence a su eterno rival Boca Juniors 3-1 en el Santiago Bernabéu, conquistando la cuarta Libertadores.", detail: "Una final sin precedentes en territorio europeo. Marcos Acuña, Rafael Santos Borré (x2) y el descuento de Villa. El mundo fue rojo y blanco aquella noche en Madrid.", destacado: true },
  { year: "2019", title: "Recopa Sudamericana", description: "River vence nuevamente a Boca y suma otro título internacional.", detail: "Con este título, Gallardo igualaba y superaba récords históricos." },
  { year: "2021", title: "El Más Monumental", description: "Finaliza la remodelación del estadio Monumental, que pasa a llamarse 'El Más Monumental'. Con 84.567 localidades, es el más grande de América.", detail: "Tecnología de punta, pantallas gigantes, nueva cubierta y una arquitectura que lo convirtió en un destino turístico.", destacado: true },
  { year: "2023", title: "Campeón de la Liga Profesional", description: "River se consagra campeón de la Liga Profesional Argentina bajo la conducción de Martín Demichelis.", detail: "Con Demichelis en el banco, River volvió a la cima del fútbol argentino." },
  { year: "2024", title: "Regresa Gallardo", description: "Marcelo Gallardo regresa al banquillo de River Plate en un retorno que emocionó a miles de hinchas en todo el mundo.", detail: "El regreso del Muñeco fue uno de los momentos más esperados por la hinchada.", destacado: true },
  { year: "2025", title: "Eduardo Coudet, el nuevo ciclo", description: "Eduardo 'Chacho' Coudet asume como Director Técnico de River Plate, con la misión de continuar la grandeza del club.", detail: "Con amplia experiencia en el fútbol europeo y sudamericano, Coudet inició una nueva etapa para River. Desde Israel, la Filial Ramat Gan sigue cada partido con la misma pasión de siempre.", imagenPortada: "/images/coudet.jpeg" },
];

function leerHitos(): HitoItem[] {
  try {
    if (existsSync(HISTORIA_FILE)) {
      const raw = readFileSync(HISTORIA_FILE, "utf-8");
      return JSON.parse(raw) as HitoItem[];
    }
  } catch { /* fall through */ }
  return HITOS_DEFAULT;
}

function guardarHitos(hitos: HitoItem[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(HISTORIA_FILE, JSON.stringify(hitos, null, 2), "utf-8");
}

// GET /historia
router.get("/historia", (_req, res) => {
  const hitos = leerHitos();
  res.json({ hitos });
});

// PATCH /historia/:index
router.patch("/historia/:index", (req, res) => {
  const idx = parseInt(req.params.index, 10);
  const hitos = leerHitos();

  if (isNaN(idx) || idx < 0 || idx >= hitos.length) {
    res.status(404).json({ error: "Hito no encontrado" });
    return;
  }

  const { title, description, detail, destacado, imagenPortada } = req.body as Partial<HitoItem>;

  if (title !== undefined) hitos[idx].title = title;
  if (description !== undefined) hitos[idx].description = description;
  if (detail !== undefined) hitos[idx].detail = detail;
  if (destacado !== undefined) hitos[idx].destacado = destacado;
  if (imagenPortada !== undefined) hitos[idx].imagenPortada = imagenPortada;

  guardarHitos(hitos);
  res.json({ ok: true, hito: hitos[idx] });
});

export default router;
