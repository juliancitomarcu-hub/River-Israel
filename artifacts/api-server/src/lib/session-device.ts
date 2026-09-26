// Informational only: User-Agent is supplied by the client, not proof of identity.
export function sessionDevice(userAgent?: string): string | null {
  const ua = userAgent?.slice(0, 512).trim();
  if (!ua) return null;
  const browser =
    /Edg(?:e|A|iOS)?\//i.test(ua) ? "Edge" :
    /(?:OPR|OPiOS)\//i.test(ua) ? "Opera" :
    /SamsungBrowser\//i.test(ua) ? "Samsung Internet" :
    /(?:Firefox|FxiOS)\//i.test(ua) ? "Firefox" :
    /(?:Chrome|CriOS)\//i.test(ua) ? "Chrome" :
    /Safari\//i.test(ua) ? "Safari" : "Navegador desconocido";
  const device =
    /iPad/i.test(ua) ? "iPad" :
    /iPhone/i.test(ua) ? "iPhone" :
    /Android/i.test(ua) ? "Android" :
    /Windows/i.test(ua) ? "Windows" :
    /CrOS/i.test(ua) ? "ChromeOS" :
    /Macintosh|Mac OS X/i.test(ua) ? "Mac" :
    /Linux/i.test(ua) ? "Linux" : "Dispositivo desconocido";
  return `${browser} · ${device}`;
}