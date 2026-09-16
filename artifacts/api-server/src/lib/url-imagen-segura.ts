/**
 * Validación anti-SSRF para URLs de imágenes externas.
 * Solo se permiten URLs http(s) públicas — nunca hosts internos,
 * IPs privadas/loopback/link-local ni IPv6 literales.
 */
import { lookup } from "node:dns/promises";

function esIpv4Privada(host: string): boolean {
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) return false;

  const [a, b, c, d] = ipv4.slice(1).map(Number);
  if ([a, b, c, d].some((octeto) => octeto > 255)) return true;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

function esIpv6Privada(host: string): boolean {
  const normalizado = host.toLowerCase();
  // IPv6 literals are not used by any of the article image sources. Reject
  // them rather than risking alternate spellings of loopback/link-local
  // addresses (including IPv4-mapped IPv6 addresses).
  return normalizado.includes(":");
}

function esHostPrivado(host: string): boolean {
  const normalizado = host.toLowerCase().replace(/\.$/, "");
  return (
    normalizado === "localhost" ||
    normalizado.endsWith(".local") ||
    normalizado.endsWith(".internal") ||
    esIpv4Privada(normalizado) ||
    esIpv6Privada(normalizado)
  );
}

export function urlImagenSegura(imagenUrl: string): boolean {
  try {
    const u = new URL(imagenUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (u.username || u.password || (u.port && u.port !== "80" && u.port !== "443")) return false;
    if (!u.hostname || esHostPrivado(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * La validación sintáctica no alcanza para un hostname controlado por un
 * atacante: podría resolver a 127.0.0.1 o a la metadata service. Los
 * endpoints que descargan una imagen deben validar también todos los
 * resultados DNS justo antes de hacer el fetch.
 */
export async function urlImagenSeguraAsync(imagenUrl: string): Promise<boolean> {
  if (!urlImagenSegura(imagenUrl)) return false;

  try {
    const host = new URL(imagenUrl).hostname;
    const direcciones = await lookup(host, { all: true, verbatim: true });
    return direcciones.length > 0 && direcciones.every(({ address }) => !esHostPrivado(address));
  } catch {
    // Fail closed if DNS cannot be resolved.
    return false;
  }
}
