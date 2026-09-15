import { Router, type IRouter } from "express";
import { leerPlantelProfesional } from "../lib/plantel";

const router: IRouter = Router();

/**
 * Returns only the last roster that passed validation and was persisted in
 * app_estado. A failed upstream refresh therefore never makes this endpoint
 * return a partial replacement.
 */
router.get("/plantel", async (_req, res) => {
  const plantel = await leerPlantelProfesional();
  if (!plantel) {
    res.status(503).json({
      error: "El plantel oficial todavía no está disponible. Se reintentará su actualización automáticamente.",
    });
    return;
  }
  res.json(plantel);
});

export default router;