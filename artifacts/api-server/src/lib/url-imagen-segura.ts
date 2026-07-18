/**
 * Validación anti-SSRF para URLs de imágenes externas.
 * Solo se permiten URLs http(s) públicas — nunca hosts internos,
 * IPs privadas/loopback/link-local ni IPv6 literales.
 */
export function urlImagenSegura(imagenUrl: string): boolean {
  try {
    const u = new URL(imagenUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
    // IPv4 literal: bloquear rangos privados/loopback/link-local/metadata
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (ipv4) {
      const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
      if (a === 10 || a === 127 || a === 0) return false;
      if (a === 169 && b === 254) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
    }
    // IPv6 literal: bloquear todas (las fuentes de noticias no usan IPs literales)
    if (host.includes(":")) return false;
    return true;
  } catch {
    return false;
  }
}
