import { Router, type IRouter } from "express";
import { db, editTokensTable } from "@workspace/db";
import { desc, isNull } from "drizzle-orm";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  leerRedactorSettings,
  guardarRedactorSettings,
  ttlHorasValido,
  ttlMinutosValido,
  LINK_RESUMEN_TTL_HORAS_MIN,
  LINK_RESUMEN_TTL_HORAS_MAX,
  LINK_EDICION_TTL_MINUTOS_MIN,
  LINK_EDICION_TTL_MINUTOS_MAX,
  type RedactorSettings,
} from "../lib/redactor-settings";

const router: IRouter = Router();

router.use("/redactor-settings", requireAdmin);

// Busca el último link "de resumen" emitido (resumen diario o aviso de
// traducción; son los tokens sin noticia asociada) para que el panel pueda
// mostrar hasta cuándo sigue siendo válido. Los tokens caducados se purgan
// periódicamente, así que si el último ya fue borrado devolvemos null.
async function ultimoLinkResumen(): Promise<
  { creadoEn: string; expiraEn: string; usado: boolean } | null
> {
  const rows = await db
    .select({
      createdAt: editTokensTable.createdAt,
      expiresAt: editTokensTable.expiresAt,
      usedAt: editTokensTable.usedAt,
    })
    .from(editTokensTable)
    .where(isNull(editTokensTable.noticiaId))
    .orderBy(desc(editTokensTable.createdAt))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    creadoEn: row.createdAt.toISOString(),
    expiraEn: row.expiresAt.toISOString(),
    usado: row.usedAt !== null,
  };
}

// Devuelve la configuración editable del panel.
router.get("/redactor-settings", async (req, res) => {
  const settings = leerRedactorSettings();
  let linkResumen: Awaited<ReturnType<typeof ultimoLinkResumen>> = null;
  try {
    linkResumen = await ultimoLinkResumen();
  } catch (err) {
    req.log.error({ err }, "No se pudo consultar el último link de resumen");
  }
  res.set("Cache-Control", "no-store");
  res.json({
    resumenHebreoHora: settings.resumenHebreoHora,
    linkResumenTtlHoras: settings.linkResumenTtlHoras,
    linkEdicionTtlMinutos: settings.linkEdicionTtlMinutos,
    resumenSeccionHebreo: settings.resumenSeccionHebreo,
    resumenSeccionPostulaciones: settings.resumenSeccionPostulaciones,
    resumenSeccionBorradoresEs: settings.resumenSeccionBorradoresEs,
    ultimoLinkResumen: linkResumen,
  });
});

// Actualiza la configuración del panel. Acepta cualquiera de los campos:
// - `resumenHebreoHora`: entero 0-23 (hora Israel) o null para desactivar.
// - `linkResumenTtlHoras`: entero entre el mínimo y máximo permitidos (horas
//   que dura el link de los avisos "de resumen").
// - `linkEdicionTtlMinutos`: entero entre el mínimo y máximo permitidos
//   (minutos que dura el link de edición de cada nota recién creada).
// - `resumenSeccion{Hebreo,Postulaciones,BorradoresEs}`: booleanos que activan
//   o desactivan cada sección del resumen diario.
router.put("/redactor-settings", (req, res) => {
  const body = req.body as {
    resumenHebreoHora?: unknown;
    linkResumenTtlHoras?: unknown;
    linkEdicionTtlMinutos?: unknown;
    resumenSeccionHebreo?: unknown;
    resumenSeccionPostulaciones?: unknown;
    resumenSeccionBorradoresEs?: unknown;
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

  if ("linkEdicionTtlMinutos" in body) {
    const valor = body.linkEdicionTtlMinutos;
    if (ttlMinutosValido(valor)) {
      patch.linkEdicionTtlMinutos = valor;
    } else {
      res.status(400).json({
        error: `linkEdicionTtlMinutos debe ser un entero entre ${LINK_EDICION_TTL_MINUTOS_MIN} y ${LINK_EDICION_TTL_MINUTOS_MAX}`,
      });
      return;
    }
  }

  for (const campo of [
    "resumenSeccionHebreo",
    "resumenSeccionPostulaciones",
    "resumenSeccionBorradoresEs",
  ] as const) {
    if (campo in body) {
      const valor = body[campo];
      if (typeof valor === "boolean") {
        patch[campo] = valor;
      } else {
        res.status(400).json({ error: `${campo} debe ser true o false` });
        return;
      }
    }
  }

  const settings = guardarRedactorSettings(patch);
  req.log.info(
    {
      resumenHebreoHora: settings.resumenHebreoHora,
      linkResumenTtlHoras: settings.linkResumenTtlHoras,
      linkEdicionTtlMinutos: settings.linkEdicionTtlMinutos,
      resumenSeccionHebreo: settings.resumenSeccionHebreo,
      resumenSeccionPostulaciones: settings.resumenSeccionPostulaciones,
      resumenSeccionBorradoresEs: settings.resumenSeccionBorradoresEs,
    },
    "Redactor settings: configuración actualizada",
  );
  res.json({
    resumenHebreoHora: settings.resumenHebreoHora,
    linkResumenTtlHoras: settings.linkResumenTtlHoras,
    linkEdicionTtlMinutos: settings.linkEdicionTtlMinutos,
    resumenSeccionHebreo: settings.resumenSeccionHebreo,
    resumenSeccionPostulaciones: settings.resumenSeccionPostulaciones,
    resumenSeccionBorradoresEs: settings.resumenSeccionBorradoresEs,
  });
});

export default router;
