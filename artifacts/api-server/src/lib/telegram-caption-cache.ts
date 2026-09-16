import { createHash } from "node:crypto";

const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ENTRIES = 250;

const porTexto = new Map<string, { caption: string; expiresAt: number }>();
const porNota = new Map<number, { caption: string; expiresAt: number }>();

function clave(texto: string): string {
  return createHash("sha256").update(texto).digest("hex");
}

function purgar(): void {
  const ahora = Date.now();
  for (const [key, value] of porTexto) {
    if (value.expiresAt <= ahora) porTexto.delete(key);
  }
  for (const [key, value] of porNota) {
    if (value.expiresAt <= ahora) porNota.delete(key);
  }
  while (porTexto.size > MAX_ENTRIES) porTexto.delete(porTexto.keys().next().value as string);
  while (porNota.size > MAX_ENTRIES) porNota.delete(porNota.keys().next().value as number);
}

export function recordarCaptionPorTexto(texto: string, caption: string): void {
  purgar();
  porTexto.set(clave(texto), { caption, expiresAt: Date.now() + TTL_MS });
}

export function obtenerCaptionPorTexto(texto: string): string | null {
  purgar();
  return porTexto.get(clave(texto))?.caption ?? null;
}

export function recordarCaptionPorNota(id: number, caption: string): void {
  purgar();
  porNota.set(id, { caption, expiresAt: Date.now() + TTL_MS });
}

export function obtenerCaptionPorNota(id: number): string | null {
  purgar();
  return porNota.get(id)?.caption ?? null;
}