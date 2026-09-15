import { logger } from "./logger";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";
const ARTICLE_URL_PLACEHOLDER = "{{ARTICLE_URL}}";
const MAX_ATTEMPTS = 2;
class OpenAIQuotaError extends Error {}

export function asegurarOpenAIConfigurado(): void {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY no está configurada");
  }
}

export interface NewsGenerationInput {
  sourceText: string;
  sourceUrl?: string | null;
  /** Date of the match/event, never the date on which the source was published. */
  eventDate?: Date | null;
  categoria?: "river" | "seleccion";
}

export interface GeneratedNewsPackage {
  titulo: string;
  bajada: string;
  tags: string;
  web_content: string;
  telegram_caption: string;
}

/**
 * Returns the current Argentina/Israel offset for a known instant. This uses
 * the IANA time zones instead of a fixed month rule, so Israeli DST changes
 * (and any future rule changes) are handled by the runtime's tz database.
 */
export function diferenciaHorariaArgentinaIsrael(fecha: Date): number {
  const offsetMinutes = (timeZone: string): number => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      calendar: "iso8601",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(fecha);
    const values = Object.fromEntries(
      parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]),
    );
    const localAsUtc = Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second,
    );
    return Math.round((localAsUtc - fecha.getTime()) / 60_000);
  };

  return (offsetMinutes("Asia/Jerusalem") - offsetMinutes("America/Argentina/Buenos_Aires")) / 60;
}

const MESES_ES: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

const PALABRAS_EVENTO =
  /\b(partid\w*|jueg\w*|jug\w*|enfrent\w*|recib\w*|visit\w*|duel\w*|encuentr\w*|fixture|fech\w*|debut\w*|semifinal\w*|final\w*|horari\w*|hora|vs\.?)\b/i;

function fechaCalendario(anio: number, mes: number, dia: number): Date | null {
  const fecha = new Date(Date.UTC(anio, mes, dia, 12));
  return fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes &&
    fecha.getUTCDate() === dia
    ? fecha
    : null;
}

/**
 * Finds an explicitly stated match/event date in a cable. The publication
 * date is deliberately used only as an optional year for Spanish dates that
 * omit the year; it is never returned as the event date by itself.
 */
export function extraerFechaDelEvento(texto: string, anioReferencia?: number): Date | null {
  const candidatos: Array<{ fecha: Date; indice: number }> = [];

  const agregar = (dia: number, mes: number, anio: number, indice: number) => {
    const fecha = fechaCalendario(anio, mes, dia);
    if (fecha) candidatos.push({ fecha, indice });
  };

  const iso = /\b(20\d{2})[/-](\d{1,2})[/-](\d{1,2})\b/g;
  for (const match of texto.matchAll(iso)) {
    agregar(Number(match[3]), Number(match[2]) - 1, Number(match[1]), match.index ?? 0);
  }

  const numerica = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/g;
  for (const match of texto.matchAll(numerica)) {
    const anio = match[3] ? Number(match[3]) : anioReferencia;
    if (anio) agregar(Number(match[1]), Number(match[2]) - 1, anio, match.index ?? 0);
  }

  const meses = Object.keys(MESES_ES).join("|");
  const espanola = new RegExp(
    `\\b(\\d{1,2})\\s+de\\s+(${meses})(?:\\s+de\\s+(20\\d{2}))?\\b`,
    "gi",
  );
  for (const match of texto.matchAll(espanola)) {
    const anio = match[3] ? Number(match[3]) : anioReferencia;
    const mes = MESES_ES[match[2].toLowerCase()];
    if (anio !== undefined && mes !== undefined) {
      agregar(Number(match[1]), mes, anio, match.index ?? 0);
    }
  }

  const vinculados = candidatos
    .map((candidato) => {
      const inicio = Math.max(0, candidato.indice - 120);
      const fin = Math.min(texto.length, candidato.indice + 120);
      const contexto = texto.slice(inicio, fin);
      const posicionCandidato = candidato.indice - inicio;
      const eventos = Array.from(contexto.matchAll(new RegExp(PALABRAS_EVENTO.source, "gi")))
        .map((evento) => evento.index ?? -1)
        .filter((indice) => indice >= 0);
      const evento = eventos
        .sort((a, b) => Math.abs(a - posicionCandidato) - Math.abs(b - posicionCandidato))[0];
      return {
        ...candidato,
        distancia: evento < 0
          ? Number.POSITIVE_INFINITY
          : Math.abs(evento - posicionCandidato) + (evento > posicionCandidato ? 15 : 0),
      };
    })
    .filter((candidato) => Number.isFinite(candidato.distancia))
    .sort((a, b) => a.distancia - b.distancia);

  return vinculados[0]?.fecha ?? null;
}

function palabras(texto: string): string[] {
  return texto
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_`]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function contarPalabras(texto: string): number {
  return palabras(texto).length;
}

function limpiarJson(texto: string): string {
  const trimmed = texto.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

function extraerOraciones(texto: string): string[] {
  // Links are replaced before counting so punctuation in Markdown/URLs cannot
  // turn one hook into several apparent sentences.
  const sinLink = texto.replace(/\[[^\]]*\]\([^)]*\)/g, "LINK");
  return (sinLink.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [])
    .map((oracion) => oracion.trim())
    .filter(Boolean);
}

function contarOraciones(texto: string): number {
  return extraerOraciones(texto).length;
}

function tieneEmoji(texto: string): boolean {
  return /\p{Extended_Pictographic}/u.test(texto);
}

function tieneEmojiEnCadaOracion(texto: string): boolean {
  const oraciones = extraerOraciones(texto);
  return oraciones.length === 2 && oraciones.every((oracion) => tieneEmoji(oracion));
}

function tieneEnlaceWeb(texto: string, allowPlaceholder: boolean): boolean {
  return allowPlaceholder
    ? /\{\{ARTICLE_URL\}\}/.test(texto)
    : /https?:\/\/[^\s)]+/.test(texto);
}

function validarPaquete(
  value: unknown,
  allowUrlPlaceholder = true,
): GeneratedNewsPackage {
  if (!value || typeof value !== "object") throw new Error("La IA devolvió un objeto inválido");
  const output = value as Partial<GeneratedNewsPackage>;
  const requiredStrings: (keyof GeneratedNewsPackage)[] = [
    "titulo",
    "bajada",
    "tags",
    "web_content",
    "telegram_caption",
  ];
  for (const key of requiredStrings) {
    if (typeof output[key] !== "string" || !output[key].trim()) {
      throw new Error(`La salida de IA no contiene ${key}`);
    }
  }

  const webContent = output.web_content!.trim();
  const caption = output.telegram_caption!.trim();
  if (contarPalabras(output.titulo!.trim()) > 12) {
    throw new Error("El título supera las 12 palabras");
  }
  const articleWords = contarPalabras(webContent);
  if (articleWords < 300 || articleWords > 400) {
    throw new Error(`El artículo tiene ${articleWords} palabras; se requieren entre 300 y 400`);
  }
  if (contarPalabras(caption) > 60) {
    throw new Error("El telegram_caption supera las 60 palabras");
  }
  if (contarOraciones(caption) !== 2) {
    throw new Error("El telegram_caption debe tener exactamente 2 oraciones");
  }
  if (!tieneEmojiEnCadaOracion(caption)) {
    throw new Error("Cada oración del telegram_caption debe contener emojis");
  }
  if (!tieneEnlaceWeb(caption, allowUrlPlaceholder)) {
    throw new Error("El telegram_caption debe contener un enlace web");
  }
  if (
    allowUrlPlaceholder &&
    (caption.match(/\{\{ARTICLE_URL\}\}/g) ?? []).length !== 1
  ) {
    throw new Error("El telegram_caption debe contener un único marcador de URL");
  }
  if (caption.includes(ARTICLE_URL_PLACEHOLDER) && !allowUrlPlaceholder) {
    throw new Error("El telegram_caption conserva el marcador de URL");
  }

  return {
    titulo: output.titulo!.trim(),
    bajada: output.bajada!.trim(),
    tags: output.tags!.trim(),
    web_content: webContent,
    telegram_caption: caption,
  };
}

function contextoHorario(eventDate: Date | null | undefined): string {
  if (!eventDate) {
    return "No hay una fecha exacta verificable para el evento. No inventes fecha ni canal. Si el cable da una hora argentina sin fecha, aplicá la regla solicitada ART +6 horas, indicá que es hora de Israel y no agregues una fecha inventada. Si el cable da una fecha exacta del evento, usá la conversión IANA estacional que corresponda (habitualmente +6 en verano y +5 en invierno).";
  }
  const diferencia = diferenciaHorariaArgentinaIsrael(eventDate);
  return `La fecha del partido/evento verificable es ${eventDate.toISOString()}. Para esa fecha, convertí horarios de Argentina a Israel usando IANA (America/Argentina/Buenos_Aires → Asia/Jerusalem): la diferencia vigente es ${diferencia >= 0 ? "+" : ""}${diferencia} horas. No uses la fecha de publicación del cable ni una diferencia fija; si no hay fecha del evento, no inventes una conversión.`;
}

const SYSTEM_PROMPT_RIVER = `Sos el redactor jefe de River en Israel, un portal partidario de River Plate para hinchas que siguen al Millonario desde Israel. Escribí en español rioplatense, con energía y rigor periodístico, poniendo a River en el centro sin vulgaridad gratuita.

La fuente es un cable interno no publicado. Usá exclusivamente los hechos explícitos de la fuente delimitada. No inventes declaraciones, citas, resultados, jugadores, lesiones, formaciones, cargos, cifras, horarios, canales de TV, confirmaciones oficiales, decisiones arbitrales ni fallos de organismos. Conservá el grado de certeza: un rumor sigue siendo rumor y una posibilidad no es un hecho. No atribuyas decisiones oficiales sin confirmación explícita. No nombres el medio o sitio de origen. Si falta un dato, omitilo o expresá claramente que no está confirmado.

Contexto factual vigente que no se puede degradar: Leonardo Ponzio es el DT interino de River. Eduardo "Chacho" Coudet dejó de ser el entrenador y no puede aparecer tomando decisiones presentes; Marcelo Gallardo y Martín Demichelis también son ex-DT. Si la fuente posterior menciona un cambio de entrenador, presentalo como confirmado solamente si el propio cable incluye una confirmación oficial de River. Nunca completes de memoria el plantel, posiciones, altas, bajas o titularidades: si no sabés si alguien sigue en el plantel, referite al equipo como colectivo.

Cuando la fuente mencione una polémica arbitral, describí solamente el hecho verificable y la reacción documentada: nunca sugieras complicidad, favores, ilegitimidad, ni fabriques un juicio arbitral o una resolución. River puede ser el protagonista y la voz puede ser apasionada, pero los hechos mandan.

Generá un paquete JSON para publicar:
- titulo: título SEO periodístico, directo, máximo 12 palabras.
- bajada: una oración precisa que resuma el dato central, sin agregar información.
- web_content: artículo original de 300 a 400 palabras, con tono de hincha de River, párrafos de hasta 3 oraciones. Usá Markdown limpio solamente para negritas puntuales y listas si los hechos explícitos las justifican. No incluy título, bajada, hashtags, enlaces, fuentes ni comentarios sobre estas instrucciones dentro de web_content. No rellenes: si el cable es escaso, desarrollá contexto únicamente cuando esté explícitamente disponible.
- tags: hashtags breves y pertinentes.
- telegram_caption: máximo 60 palabras y exactamente 2 oraciones completas. Ambas deben tener emojis. La segunda debe incluir el enlace Markdown [Leer la nota completa en la web]({{ARTICLE_URL}}). Debe ser un gancho que no revele todo el análisis ni copie el artículo. No incluy la nota completa, fuente, nombre del medio, ni afirmaciones no sustentadas.

El artículo debe incluir la hora local de Israel solamente cuando la fuente proporcione una hora y una fecha verificables. Aplicá la instrucción de conversión temporal que recibe este pedido: cuando la fecha sea conocida se usa la diferencia IANA calculada para esa fecha (Israel suele ser ART +6 en verano y ART +5 en invierno); jamás inventes un canal de TV. El cierre debe ser completo y factual, con identidad de la comunidad de River en Israel sin convertirla en publicidad.`;

const SYSTEM_PROMPT_SELECCION = `${SYSTEM_PROMPT_RIVER}

La categoría es Selección Argentina. Mantené el foco en la Selección y no conviertas datos de River en hechos de la selección.`;

const JSON_SCHEMA = {
  name: "river_news_package",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["titulo", "bajada", "tags", "web_content", "telegram_caption"],
    properties: {
      titulo: { type: "string" },
      bajada: { type: "string" },
      tags: { type: "string" },
      web_content: { type: "string" },
      telegram_caption: { type: "string" },
    },
  },
} as const;

async function pedirOpenAI(input: NewsGenerationInput): Promise<GeneratedNewsPackage> {
  asegurarOpenAIConfigurado();
  const apiKey = process.env.OPENAI_API_KEY!.trim();

  const categoria = input.categoria === "seleccion" ? "seleccion" : "river";
  const sourceUrl = input.sourceUrl?.trim() || "no disponible";
  const userPrompt = `CATEGORÍA: ${categoria}
${contextoHorario(input.eventDate)}
URL DE ORIGEN (solo contexto interno, no la menciones): ${sourceUrl}

<FUENTE_INTERNA>
${input.sourceText.trim()}
</FUENTE_INTERNA>

Devolvé únicamente el objeto JSON solicitado.`;

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      max_tokens: 2200,
      response_format: { type: "json_schema", json_schema: JSON_SCHEMA },
      messages: [
        {
          role: "system",
          content: categoria === "seleccion" ? SYSTEM_PROMPT_SELECCION : SYSTEM_PROMPT_RIVER,
        },
        { role: "user", content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    // Inspect only allowlisted codes; never log the provider response body.
    const failure = await response.json().catch(() => null) as {
      error?: { code?: string; type?: string };
    } | null;
    if (failure?.error?.code === "credit_balance_exhausted" ||
        failure?.error?.code === "insufficient_quota" ||
        failure?.error?.type === "insufficient_quota") {
      throw new OpenAIQuotaError(
        "OpenAI no tiene créditos disponibles. Recargá saldo en la facturación de OpenAI para reanudar la generación.",
      );
    }
    throw new Error(`OpenAI respondió HTTP ${response.status}`);
  }
  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI devolvió una respuesta vacía");
  return validarPaquete(JSON.parse(limpiarJson(content)));
}

/**
 * Generates and validates the complete web/Telegram package before callers
 * write anything to the database. One bounded retry handles transient API
 * failures or an otherwise invalid structured response; after that it fails
 * closed so a partial or fabricated note cannot be saved.
 */
export async function generarNotaEstructurada(input: NewsGenerationInput): Promise<GeneratedNewsPackage> {
  if (input.sourceText.trim().length < 10) {
    throw new Error("La fuente es demasiado corta para generar una nota");
  }

  let ultimoError: unknown;
  for (let intento = 1; intento <= MAX_ATTEMPTS; intento++) {
    try {
      return await pedirOpenAI(input);
    } catch (error) {
      if (error instanceof OpenAIQuotaError) throw error;
      ultimoError = error;
      if (intento < MAX_ATTEMPTS) {
        logger.warn({ intento }, "OpenAI: salida inválida o error transitorio; reintentando");
      }
    }
  }
  throw new Error(
    ultimoError instanceof Error
      ? `No se pudo generar una nota editorial válida: ${ultimoError.message}`
      : "No se pudo generar una nota editorial válida",
  );
}

function limpiarTextoTelegram(texto: string): string {
  return texto
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^\S\r\n]+([.!?])/g, "$1")
    .trim();
}

/** Deterministic, short fallback used only for old/manual records. */
export function construirCaptionTelegram(input: {
  titulo: string;
  contenido?: string | null;
  url: string;
}): string {
  const titulo = (
    palabras(limpiarTextoTelegram(input.titulo).replace(/[.!?]/g, "")).slice(0, 18).join(" ")
    || "La nueva nota de River"
  );
  const segundo = "🚨 Leé el análisis completo y todos los detalles en la web";
  return `⚪️🔴 ${titulo}. ${segundo}: [Leer la nota completa en la web](${input.url}).`;
}

export function resolverCaptionTelegram(
  caption: string | null | undefined,
  input: { titulo: string; contenido?: string | null; url: string },
): string {
  const candidato = caption?.trim().replaceAll(ARTICLE_URL_PLACEHOLDER, input.url);
  if (
    candidato &&
    contarPalabras(candidato) <= 60 &&
    contarOraciones(candidato) === 2 &&
    tieneEmojiEnCadaOracion(candidato) &&
    tieneEnlaceWeb(candidato, false)
  ) {
    return candidato;
  }
  return construirCaptionTelegram(input);
}

export function validarTelegramCaption(caption: string): boolean {
  return (
    contarPalabras(caption) <= 60 &&
    contarOraciones(caption) === 2 &&
    tieneEmojiEnCadaOracion(caption) &&
    tieneEnlaceWeb(caption, false)
  );
}

export { ARTICLE_URL_PLACEHOLDER };