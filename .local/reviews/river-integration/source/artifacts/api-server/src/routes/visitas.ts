import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { visitasTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

// Asegura que exista la fila del contador (se llama al arrancar el server)
async function inicializarContador() {
  try {
    const rows = await db.select().from(visitasTable).limit(1);
    if (rows.length === 0) {
      await db.insert(visitasTable).values({ total: 0, unicas: 0 });
    }
  } catch {
    // Si la tabla no existe todavía, se ignora — se creará con el push de schema
  }
}

inicializarContador();

// ─── GET /api/visitas ─────────────────────────────────────────────────────────
// Retorna el conteo actual. El frontend decide si es visita única via localStorage.

router.get("/visitas", async (req, res) => {
  try {
    const [fila] = await db.select().from(visitasTable).limit(1);
    if (!fila) {
      res.json({ total: 0, unicas: 0 });
      return;
    }
    res.json({ total: fila.total, unicas: fila.unicas });
  } catch (err) {
    req.log.error({ err }, "Error obteniendo visitas");
    res.json({ total: 0, unicas: 0 });
  }
});

// ─── POST /api/visitas ────────────────────────────────────────────────────────
// Registra una visita. Body: { unica: boolean }

router.post("/visitas", async (req, res) => {
  const esUnica = Boolean((req.body as { unica?: boolean })?.unica);

  try {
    const [fila] = await db.select().from(visitasTable).limit(1);

    if (!fila) {
      // Crear la fila si no existe
      const [nueva] = await db
        .insert(visitasTable)
        .values({ total: 1, unicas: esUnica ? 1 : 0 })
        .returning();
      res.json({ total: nueva.total, unicas: nueva.unicas });
      return;
    }

    const [actualizada] = await db
      .update(visitasTable)
      .set({
        total: sql`${visitasTable.total} + 1`,
        ...(esUnica ? { unicas: sql`${visitasTable.unicas} + 1` } : {}),
        actualizadoEn: new Date(),
      })
      .returning();

    res.json({ total: actualizada.total, unicas: actualizada.unicas });
  } catch (err) {
    req.log.error({ err }, "Error registrando visita");
    res.json({ total: 0, unicas: 0 });
  }
});

export default router;
