/**
 * Conservative title comparison for the scheduler.
 *
 * A shared person's name is not enough to identify the same story. Exact
 * normalized titles are still duplicates (including short titles), while
 * approximate matches need several distinct, meaningful tokens and a high
 * overlap proportion.
 */

export interface TitulosNoticia {
  /** Title supplied by the source, before any editorial rewrite. */
  original?: string | null;
  /** Title stored after the editorial rewrite. */
  reescrito?: string | null;
}

const MIN_TOKENS_COMPARTIDOS = 3;
const MIN_PROPORCION_COMPARTIDA = 0.75;

// These words are useful for exact matching, but are too common to establish
// that two otherwise different headlines cover the same story.
const PALABRAS_NO_DISTINTIVAS = new Set([
  "a", "al", "ante", "bajo", "con", "contra", "como", "de", "del", "desde",
  "e", "el", "en", "entre", "es", "esta", "este", "la", "las", "lo", "los",
  "más", "muy", "o", "para", "por", "que", "se", "sin", "su", "sus", "un",
  "una", "unas", "uno", "unos", "y",
  "argentina", "argentino", "argentinos", "equipo", "entrenador", "futbol",
  "jugador", "jugadores", "millonario", "millonarios", "monumental", "mundial",
  "nunez", "partido", "river", "scaloneta", "seleccion", "tecnico",
]);

function quitarAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normalizes punctuation and accents without deleting numbers. Keeping
 * numbers lets the comparator distinguish headlines about different dates,
 * scores, editions, or shirt numbers.
 */
export function normalizarTitulo(titulo: string): string {
  return quitarAcentos(titulo)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokensUnicos(tituloNormalizado: string): string[] {
  return [...new Set(tituloNormalizado.split(" ").filter(Boolean))];
}

function tokensSignificativos(tituloNormalizado: string): string[] {
  return tokensUnicos(tituloNormalizado)
    .filter((token) => token.length >= 3 && !PALABRAS_NO_DISTINTIVAS.has(token));
}

function tokensNumericos(tituloNormalizado: string): Set<string> {
  return new Set(tokensUnicos(tituloNormalizado).filter((token) => /^\d+$/.test(token)));
}

function mismosNumeros(a: string, b: string): boolean {
  const numerosA = tokensNumericos(a);
  const numerosB = tokensNumericos(b);
  if (numerosA.size === 0 && numerosB.size === 0) return true;
  if (numerosA.size !== numerosB.size) return false;
  return [...numerosA].every((numero) => numerosB.has(numero));
}

/**
 * Compares one source/re-written title pair. This is intentionally stricter
 * than a prefix or substring comparison: repeated tokens count once, and a
 * pair of person-name tokens cannot meet the approximate-match threshold.
 */
export function sonTitulosDuplicados(tituloA: string, tituloB: string): boolean {
  const normalizadoA = normalizarTitulo(tituloA);
  const normalizadoB = normalizarTitulo(tituloB);

  if (!normalizadoA || !normalizadoB) return false;
  if (normalizadoA === normalizadoB) return true;

  // A different date, score, edition, or other number is a strong signal that
  // the two headlines describe different facts. Exact normalization above
  // still handles equivalent numeric formatting.
  if (!mismosNumeros(normalizadoA, normalizadoB)) return false;

  const tokensA = tokensSignificativos(normalizadoA);
  const tokensB = tokensSignificativos(normalizadoB);
  if (tokensA.length < MIN_TOKENS_COMPARTIDOS || tokensB.length < MIN_TOKENS_COMPARTIDOS) {
    return false;
  }

  const conjuntoB = new Set(tokensB);
  const compartidos = tokensA.filter((token) => conjuntoB.has(token)).length;
  if (compartidos < MIN_TOKENS_COMPARTIDOS) return false;

  const proporcionCompartida = compartidos / Math.max(tokensA.length, tokensB.length);
  return proporcionCompartida >= MIN_PROPORCION_COMPARTIDA;
}

/**
 * Checks the source title first, then the rewritten title. A source title is
 * the stronger signal, but rewritten titles remain useful when the source
 * title is absent or was changed by the editorial pipeline.
 */
export function noticiaDuplicadaPorTitulo(
  candidato: string,
  existente: TitulosNoticia,
): boolean {
  const titulos = [existente.original, existente.reescrito];
  for (const titulo of titulos) {
    if (titulo && sonTitulosDuplicados(candidato, titulo)) return true;
  }
  return false;
}