import { useLocation } from "wouter";
import { useEffect } from "react";

/**
 * Modo Mundial = el usuario está en La Scaloneta (home por defecto).
 * Dos sitios paralelos:
 *   /         → La Scaloneta en Israel (default)
 *   /river    → River en Israel
 *   /scaloneta (legacy) → mismo home que /
 *
 * El usuario alterna entre sitios desde el menú desplegable arriba a la derecha.
 */

const RIVER_PREFIX = "/river";

export function useMundialMode(): boolean {
  const [location] = useLocation();
  // Activo en todas las rutas excepto las que viven bajo /river.
  const enRiver = location === RIVER_PREFIX || location.startsWith(`${RIVER_PREFIX}/`);
  const active = !enRiver;

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
