import { Router, type IRouter } from "express";
import { db, editTokensTable, noticiasTable } from "@workspace/db";
import { and, desc, eq, gt, isNotNull, isNull } from "drizzle-orm";
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
import { contarPendientesResumen } from "../lib/resumen-pendientes";
import { createEditToken, descripcionTtlEdicion } from "../lib/edit-tokens";
import { credencialesTelegram } from "../lib/telegram-cred";

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

// Lista los últimos links de edición por nota (tokens con noticiaId) con el
// título de la nota, para que el panel muestre cuáles siguen vigentes, cuáles
// fueron usados y cuáles caducaron. Los caducados se purgan periódicamente,
// así que la lista solo refleja los que todavía existen en la tabla.
// Incluye el token para que el panel pueda anular links vigentes.
async function ultimosLinksEdicion(): Promise<
  Array<{
    token: string;
    noticiaId: number;
    titulo: string | null;
    creadoEn: string;
    expiraEn: string;
    usado: boolean;
  }>
> {
  const rows = await db
    .select({
      token: editTokensTable.token,
      noticiaId: editTokensTable.noticiaId,
      createdAt: editTokensTable.createdAt,
      expiresAt: editTokensTable.expiresAt,
      usedAt: editTokensTable.usedAt,
      titulo: noticiasTable.titulo,
    })
    .from(editTokensTable)
    .leftJoin(noticiasTable, eq(editTokensTable.noticiaId, noticiasTable.id))
    .where(isNotNull(editTokensTable.noticiaId))
    .orderBy(desc(editTokensTable.createdAt))
    .limit(10);
  return rows.map((row) => ({
    token: row.token,
    noticiaId: row.noticiaId as number,
    titulo: row.titulo,
    creadoEn: row.createdAt.toISOString(),
    expiraEn: row.expiresAt.toISOString(),
    usado: row.usedAt !== null,
  }));
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
  let linksEdicion: Awaited<ReturnType<typeof ultimosLinksEdicion>> = [];
  try {
    linksEdicion = await ultimosLinksEdicion();
  } catch (err) {
    req.log.error({ err }, "No se pudieron consultar los links de edición por nota");
  }
  // Conteos en vivo de pendientes por sección del resumen diario (mismas
  // queries que usa el scheduler al armar el mensaje de Telegram). Si la
  // consulta falla devolvemos null y el panel simplemente no muestra números.
  let conteos: Awaited<ReturnType<typeof contarPendientesResumen>> | null = null;
  try {
    conteos = await contarPendientesResumen();
  } catch (err) {
    req.log.error({ err }, "No se pudieron contar los pendientes del resumen");
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
    ultimosLinksEdicion: linksEdicion,
    conteosResumen: conteos,
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

// Emite un reemplazo sin modificar la nota ni revocar otros links.
router.post("/redactor-settings/links-edicion/:noticiaId", async (req, res) => {
  const noticiaId = Number(req.params.noticiaId);
  if (!Number.isSafeInteger(noticiaId) || noticiaId <= 0) {
    res.status(400).json({ error: "Identificador de nota inválido" });
    return;
  }
  const [nota] = await db.select({
    id: noticiasTable.id, titulo: noticiasTable.titulo, categoria: noticiasTable.categoria,
  }).from(noticiasTable).where(eq(noticiasTable.id, noticiaId)).limit(1);
  if (!nota) {
    res.status(404).json({ error: "La nota ya no existe" });
    return;
  }
  const cred = credencialesTelegram(nota.categoria === "seleccion" ? "seleccion" : "river");
  if (!cred) {
    res.status(503).json({ error: "Telegram no está configurado para esta sección" });
    return;
  }
  const token = await createEditToken(noticiaId);
  const [link] = await db.select().from(editTokensTable).where(eq(editTokensTable.token, token));
  const dominio = process.env.TELEGRAM_WEBHOOK_DOMAIN ?? "riverplateisrael.com";
  try {
    const response = await fetch(`https://api.telegram.org/bot${cred.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        chat_id: cred.chatId,
        text: `Nuevo link de edición — ${cred.marca}\n\n${nota.titulo.slice(0, 500)}\n\nEl link dura ${descripcionTtlEdicion()} y es de un solo uso.`,
        reply_markup: { inline_keyboard: [[{
          text: "Abrir Redactor",
          url: `https://${dominio}/redactor?editar=${noticiaId}&edit_token=${token}`,
        }]] },
      }),
    });
    const data = await response.json() as { ok?: boolean };
    if (!response.ok || data.ok !== true) throw new Error("Telegram rechazó el envío");
  } catch {
    // También invalida entregas ambiguas: nunca queda un link activo tras un error.
    await db.delete(editTokensTable).where(eq(editTokensTable.token, token));
    req.log.warn({ noticiaId }, "No se pudo confirmar el envío del link de reemplazo");
    res.status(502).json({ error: "No se pudo confirmar el envío por Telegram. El nuevo link fue invalidado; podés intentar nuevamente." });
    return;
  }
  req.log.info({ noticiaId }, "Link de reemplazo enviado al redactor");
  res.status(201).json({ ok: true, link: {
    token, noticiaId, titulo: nota.titulo,
    creadoEn: link.createdAt.toISOString(), expiraEn: link.expiresAt.toISOString(), usado: false,
  } });
});

// Anula un link de edición vigente. Solo funciona si el token aún
// existe, no fue usado y no está caducado; en cualquier otro caso devuelve 404.
router.delete("/redactor-settings/links-edicion/:token", async (req, res) => {
  const { token } = req.params;
  const ahora = new Date();
  // Verificamos que el token exista, no haya sido usado y siga vigente.
  const rows = await db
    .select({ token: editTokensTable.token })
    .from(editTokensTable)
    .where(
      and(
        eq(editTokensTable.token, token),
        isNotNull(editTokensTable.noticiaId),
        isNull(editTokensTable.usedAt),
        gt(editTokensTable.expiresAt, ahora),
      ),
    )
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Token no encontrado, ya usado o caducado" });
    return;
  }
  // Conserva la fila hasta la purga para poder emitir un reemplazo desde el panel.
  await db.update(editTokensTable).set({ expiresAt: ahora }).where(eq(editTokensTable.token, token));
  req.log.info({ token }, "Redactor: link de edición anulado manualmente");
  res.json({ ok: true });
});

export default router;
