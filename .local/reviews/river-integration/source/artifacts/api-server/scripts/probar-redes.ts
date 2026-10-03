/**
 * Prueba controlada con la última noticia publicada.
 * Requiere una URL de producción verificada como primer argumento.
 * Sin --send solo genera la placa. --send hace UN envío real a Make.
 */
import { generarPlacaRedes } from "../src/lib/generar-placa-redes";
import { enviarNotaAMakeConfirmado, type NotaParaMake } from "../src/lib/enviar-a-make";

async function main() {
  const base = new URL(process.argv[2]).origin;
  if (!base.startsWith("https://")) throw new Error("Usar la URL HTTPS de producción");
  const response = await fetch(`${base}/api/noticias-publicadas?limit=1`, {
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Listado de noticias: HTTP ${response.status}`);
  const { noticias } = await response.json() as { noticias: NotaParaMake[] };
  const nota = noticias?.[0];
  if (!nota) throw new Error("No hay noticias publicadas");
  const result = process.argv.includes("--send")
    ? await enviarNotaAMakeConfirmado(nota, base)
    : await generarPlacaRedes(nota, base);
  console.log(JSON.stringify({ notaId: nota.id, titulo: nota.titulo, enviado: process.argv.includes("--send"), ...result }, null, 2));
}

main().catch(() => {
  // Do not dump network errors which may contain signed URLs or secret endpoints.
  console.error("Falló la prueba de redes. No reenviar sin comprobar antes si Make recibió el POST.");
  process.exitCode = 1;
});