import { useLocation } from "wouter";
import { useEffect } from "react";

/**
 * Modo Mundial = el usuario está navegando dentro de /scaloneta.
 * Antes era automático por fecha; ahora son dos sitios paralelos:
 *   /           → River en Israel
 *   /scaloneta  → La Scaloneta en Israel
 *
 * Cada uno con su navbar/home/footer; el usuario alterna con los
 * botones de "Cruzar al otro sitio" que están en navbar y footer.
 */

const SCALONETA_PREFIX = "/scaloneta";

export function useMundialMode(): boolean {
  const [location] = useLocation();
  const active = location === SCALONETA_PREFIX || location.startsWith(`${SCALONETA_PREFIX}/`);

  useEffect(() => {
    const root = document.documentElement;
    if (active) root.setAttribute("data-theme", "mundial");
    else root.removeAttribute("data-theme");
  }, [active]);

  return active;
}

/** True por compatibilidad con código viejo: el período del Mundial sigue vigente. */
export function isMundialPeriod(): boolean {
  return Date.now() < Date.UTC(2026, 6, 20, 21, 0, 0);
}

/** Deprecated: ya no hay override de fecha; mantenido como no-op para evitar romper imports. */
export function getMundialOverride(): "on" | "off" | null { return null; }
export function setMundialOverride(_v: "on" | "off" | null) { /* no-op */ }
export function mundialEndDate(): Date { return new Date(Date.UTC(2026, 6, 20, 21, 0, 0)); }
