import { Router, type IRouter } from "express";
import { requireAdmin } from "../middleware/requireAdmin";
import { leerRedactorSettings, guardarRedactorSettings } from "../lib/redactor-settings";

const router: IRouter = Router();

router.use("/redactor-settings", requireAdmin);

// Devuelve la configuración editable del panel.
router.get("/redactor-settings", (req, res) => {
  const settings = leerRedactorSettings();
  res.set("Cache-Control", "no-store");
  res.json({ resumenHebreoHora: settings.resumenHebreoHora });
});

// Actualiza la hora del resumen diario de hebreo.
// `resumenHebreoHora`: entero 0-23 (hora Israel) o null para desactivar.
router.put("/redactor-settings", (req, res) => {
  const body = req.body as { resumenHebreoHora?: unknown };
  const valor = body.resumenHebreoHora;

  let hora: number | null;
  if (valor === null) {
    hora = null;
  } else if (
    typeof valor === "number" &&
    Number.isInteger(valor) &&
    valor >= 0 &&
    valor <= 23
  ) {
    hora = valor;
  } else {
    res
      .status(400)
      .json({ error: "resumenHebreoHora debe ser un entero entre 0 y 23, o null para desactivar" });
    return;
  }

  const settings = guardarRedactorSettings({ resumenHebreoHora: hora });
  req.log.info({ resumenHebreoHora: hora }, "Redactor settings: hora de resumen hebreo actualizada");
  res.json({ resumenHebreoHora: settings.resumenHebreoHora });
});

export default router;
