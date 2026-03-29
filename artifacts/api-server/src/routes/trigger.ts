import { Router, type IRouter } from "express";
import { ejecutarCiclo } from "../scheduler";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/scheduler/trigger", async (req, res) => {
  const fuente = typeof req.query.fuente === "string" ? req.query.fuente : undefined;
  logger.info({ fuente: fuente ?? "auto" }, "Trigger manual del scheduler recibido");
  res.json({ ok: true, mensaje: "Ciclo iniciado en background", fuente: fuente ?? "auto" });
  ejecutarCiclo(fuente).catch((err) =>
    logger.error({ err }, "Trigger manual: error en ciclo")
  );
});

export default router;
