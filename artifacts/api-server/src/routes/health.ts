import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Endpoint temporal de diagnóstico: verifica el cálculo de horario israelí
router.get("/hora-debug", (_req, res) => {
  function ultimoDiaSemana(year: number, month: number, weekday: number): number {
    const ultimoDia = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    for (let d = ultimoDia; d >= 1; d--) {
      if (new Date(Date.UTC(year, month, d)).getUTCDay() === weekday) return d;
    }
    return ultimoDia;
  }
  const year = 2026;
  const inicioIDT = Date.UTC(year, 2, ultimoDiaSemana(year, 2, 5), 0, 0, 0);
  const finIDT    = Date.UTC(year, 9, ultimoDiaSemana(year, 9, 0), 23, 0, 0) - 24 * 3600_000;

  // Partido Boca: 19-04-2026, Promiedos UTC-4 = 16:00 → UTC 20:00
  const utcBoca   = Date.UTC(2026, 3, 19, 20, 0, 0);
  const offsetBoca = utcBoca >= inicioIDT && utcBoca < finIDT ? 3 : 2;
  const horaBoca   = new Date(utcBoca + offsetBoca * 3_600_000);

  res.json({
    nodeVersion: process.version,
    now: new Date().toISOString(),
    inicioIDT: new Date(inicioIDT).toISOString(),
    finIDT:    new Date(finIDT).toISOString(),
    bocaUtcMs:  utcBoca,
    bocaOffset: offsetBoca,
    bocaHoraIsrael: `${String(horaBoca.getUTCHours()).padStart(2,"0")}:${String(horaBoca.getUTCMinutes()).padStart(2,"0")}`,
    esperado: "23:00",
    correcto: offsetBoca === 3,
  });
});

export default router;
