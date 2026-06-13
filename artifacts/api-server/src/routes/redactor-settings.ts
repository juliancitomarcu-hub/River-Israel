import { Router, type IRouter } from "express";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  leerRedactorSettings,
  guardarRedactorSettings,
  ttlHorasValido,
  LINK_RESUMEN_TTL_HORAS_MIN,
  LINK_RESUMEN_TTL_HORAS_MAX,
  type RedactorSettings,
} from "../lib/redactor-settings";

const router: IRouter = Router();

router.use("/redactor-settings", requireAdmin);

// Devuelve la configuración editable del panel.
router.get("/redactor-settings", (req, res) => {
  const settings = leerRedactorSettings();
  res.set("Cache-Control", "no-store");
  res.json({
    resumenHebreoHora: settings.resumenHebreoHora,
    linkResumenTtlHoras: settings.linkResumenTtlHoras,
  });
});

// Actualiza la configuración del panel. Acepta cualquiera de los campos:
// - `resumenHebreoHora`: entero 0-23 (hora Israel) o null para desactivar.
// - `linkResumenTtlHoras`: entero entre el mínimo y máximo permitidos (horas
//   que dura el link de los avisos "de resumen").
router.put("/redactor-settings", (req, res) => {
  const body = req.body as {
    resumenHebreoHora?: unknown;
    linkResumenTtlHoras?: unknown;
  };

  const patch: Partial<RedactorSettings> = {};

  if ("resumenHebreoHora" in body) {
    const valor = body.resumenHebreoHora;
    if (valor === null) {
      patch.resumenHebreoHora = null;
    } else if (
      typeof valor === "number" &&
      Number.isInteger(valor) &&
      valor >= 0 &&
      valor <= 23
    ) {
      patch.resumenHebreoHora = valor;
    } else {
      res
        .status(400)
        .json({ error: "resumenHebreoHora debe ser un entero entre 0 y 23, o null para desactivar" });
      return;
    }
  }

  if ("linkResumenTtlHoras" in body) {
    const valor = body.linkResumenTtlHoras;
    if (ttlHorasValido(valor)) {
      patch.linkResumenTtlHoras = valor;
    } else {
      res.status(400).json({
        error: `linkResumenTtlHoras debe ser un entero entre ${LINK_RESUMEN_TTL_HORAS_MIN} y ${LINK_RESUMEN_TTL_HORAS_MAX}`,
      });
      return;
    }
  }

  const settings = guardarRedactorSettings(patch);
  req.log.info(
    {
      resumenHebreoHora: settings.resumenHebreoHora,
      linkResumenTtlHoras: settings.linkResumenTtlHoras,
    },
    "Redactor settings: configuración actualizada",
  );
  res.json({
    resumenHebreoHora: settings.resumenHebreoHora,
    linkResumenTtlHoras: settings.linkResumenTtlHoras,
  });
});

export default router;
