import { useLocation } from "wouter";
import { useEffect } from "react";

/**
 * Modo Mundial = el usuario está en La Scaloneta.
 * River es el sitio protagonista; La Scaloneta queda "dormida":
 *   /          → River en Israel (default)
 *   /river     → River en Israel (alias)
 *   /scaloneta → La Scaloneta en Israel (sólo acceso directo)
 *
 * El modo Mundial sólo se activa al entrar explícitamente a /scaloneta.
 */

const SCALONETA_PREFIX = "/scaloneta";

export function useMundialMode(): boolean {
  const [location] = useLocation();
  // La Scaloneta queda "dormida": el modo Mundial sólo se activa si se entra
  // explícitamente a /scaloneta. River es protagonista en la raíz "/".
  const enScaloneta =
    location === SCALONETA_PREFIX || location.startsWith(`${SCALONETA_PREFIX}/`);
  const active = enScaloneta;

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
