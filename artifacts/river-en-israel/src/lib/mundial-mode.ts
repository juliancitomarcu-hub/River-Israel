import { useEffect, useState } from "react";

/**
 * Modo Mundial = activo desde ahora hasta el 21/07/2026 00:00 hora Israel
 * (un día extra para celebrar la final del 19/07). Después revierte a River.
 *
 * 21/07/2026 00:00 IDT = 20/07/2026 21:00 UTC
 *   (Israel está en IDT = UTC+3 entre fines de marzo y fines de octubre)
 */
const MUNDIAL_END_UTC_MS = Date.UTC(2026, 6, 20, 21, 0, 0);

/**
 * Lectura/escritura del override manual via localStorage.
 * Valores: "on" | "off" | null (auto por fecha).
 */
const OVERRIDE_KEY = "mundial-mode-override";

export function getMundialOverride(): "on" | "off" | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(OVERRIDE_KEY);
  return v === "on" || v === "off" ? v : null;
}

export function setMundialOverride(v: "on" | "off" | null) {
  if (typeof window === "undefined") return;
  if (v === null) window.localStorage.removeItem(OVERRIDE_KEY);
  else window.localStorage.setItem(OVERRIDE_KEY, v);
  window.dispatchEvent(new Event("mundial-mode-change"));
}

function computeActive(): boolean {
  const override = getMundialOverride();
  if (override === "on") return true;
  if (override === "off") return false;
  return Date.now() < MUNDIAL_END_UTC_MS;
}

/**
 * Hook reactivo. Setea data-theme="mundial" en <html> cuando está activo.
 * Re-evalúa cada minuto + reacciona a cambios de override.
 */
export function useMundialMode(): boolean {
  const [active, setActive] = useState<boolean>(computeActive);

  useEffect(() => {
    const recompute = () => setActive(computeActive());
    const interval = window.setInterval(recompute, 60_000);
    window.addEventListener("mundial-mode-change", recompute);
    window.addEventListener("storage", recompute);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("mundial-mode-change", recompute);
      window.removeEventListener("storage", recompute);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (active) root.setAttribute("data-theme", "mundial");
    else root.removeAttribute("data-theme");
  }, [active]);

  return active;
}

export function mundialEndDate(): Date {
  return new Date(MUNDIAL_END_UTC_MS);
}
