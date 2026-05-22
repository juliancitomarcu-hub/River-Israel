import { Router, type IRouter } from "express";
import { db, suscriptoresTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/suscriptores", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(suscriptoresTable)
      .orderBy(desc(suscriptoresTable.createdAt));
    res.set("Cache-Control", "no-store");
    res.json({ suscriptores: rows, total: rows.length });
  } catch (err) {
    req.log.error({ err }, "Error listando suscriptores");
    res.status(500).json({ error: "Error al cargar suscriptores" });
  }
});

router.delete("/suscriptores/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  try {
    await db.delete(suscriptoresTable).where(eq(suscriptoresTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error eliminando suscriptor");
    res.status(500).json({ error: "Error al eliminar suscriptor" });
  }
});

function csvEscape(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

router.get("/suscriptores.csv", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(suscriptoresTable)
      .orderBy(desc(suscriptoresTable.createdAt));

    const header = ["nombre", "email", "telefono", "ciudad", "canales", "fecha"].join(",");
    const lines = rows.map(r => [
      csvEscape(r.nombre ?? ""),
      csvEscape(r.email ?? ""),
      csvEscape(r.telefono ?? ""),
      csvEscape(r.ciudad ?? ""),
      csvEscape(r.canales ?? ""),
      csvEscape(r.createdAt ? new Date(r.createdAt).toISOString() : ""),
    ].join(","));
    const csv = "\uFEFF" + [header, ...lines].join("\n") + "\n";

    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="suscriptores-${new Date().toISOString().slice(0,10)}.csv"`);
    res.set("Cache-Control", "no-store");
    res.send(csv);
  } catch (err) {
    req.log.error({ err }, "Error exportando CSV de suscriptores");
    res.status(500).json({ error: "Error al exportar CSV" });
  }
});

export default router;
