/**
 * Elimina todos los asteriscos (formato Markdown residual de la IA) de un texto.
 * Las notas publicadas en el sitio nunca deben contener `*`.
 */
export function limpiarAsteriscos(texto: string): string {
  return texto.replace(/\*/g, "");
}

export function limpiarNota<T extends { titulo: string; contenido: string; tags: string }>(nota: T): T {
  return {
    ...nota,
    titulo: limpiarAsteriscos(nota.titulo).trim(),
    contenido: limpiarAsteriscos(nota.contenido).trim(),
    tags: limpiarAsteriscos(nota.tags).trim(),
  };
}
