import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { noticiasTable } from "@workspace/db";
import { count as drizzleCount, desc, eq, and, sql } from "drizzle-orm";
import { sql as sqlRaw } from "drizzle-orm";
import { traducirYGuardarHebreo } from "../lib/traductor-hebreo";
import { requireAdmin, requireAdminOrNoticiaSession } from "../middleware/requireAdmin";

const requireAdminOrThisNoticia = requireAdminOrNoticiaSession((req) => {
  const id = parseInt(req.params.id ?? "", 10);
  return isNaN(id) ? null : id;
});

const router: IRouter = Router();

function parsearResultado(texto: string): { titulo: string; contenido: string; tags: string } {
  const lines = texto.split("\n");

  let titulo = "Sin título";
  let tituloLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    const m = l.match(/^\*\*Título:\*\*\s*(.+)$/);
    if (m) { titulo = m[1].trim(); tituloLineIdx = i; break; }
    if (/^\*\*Título:\*\*\s*$/.test(l) && lines[i + 1]) {
      titulo = lines[i + 1].trim().replace(/^\*\*|\*\*$/g, "");
      tituloLineIdx = i; break;
    }
  }
  if (tituloLineIdx === -1) {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].trim().match(/^\*\*([^*]+)\*\*$/);
      if (m) { titulo = m[1].trim(); tituloLineIdx = i; break; }
    }
  }

  let bajada = "";
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    const m = l.match(/^\*\*Bajada:\*\*\s*(.+)$/);
    if (m) { bajada = m[1].trim(); break; }
    if (/^\*\*Bajada:\*\*\s*$/.test(l) && lines[i + 1]) {
      bajada = lines[i + 1].trim(); break;
    }
  }

  let tags = "#RiverPlate #RiverIsrael #RamatGan #ElMasGrande";
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim();
    const m = l.match(/^\*\*Tags:\*\*\s*(.+)$/);
    if (m) { tags = m[1].trim(); break; }
    if (/^#River/.test(l) && l.includes("#")) { tags = l; break; }
  }

  const headerPatterns = [/^\*\*Título:\*\*/, /^\*\*Bajada:\*\*/, /^\*\*Contenido:\*\*/, /^\*\*Tags:\*\*/];
  const bodyLines = lines.filter((l, idx) => {
    const trimmed = l.trim();
    if (headerPatterns.some(p => p.test(trimmed))) return false;
    if (idx === tituloLineIdx) return false;
    if (bajada && trimmed === bajada) return false;
    if (/^#River/.test(trimmed) && trimmed === tags) return false;
    return true;
  });

  let contenido = bodyLines.join("\n").trim();
  if (bajada) contenido = `*${bajada}*\n\n${contenido}`;

  return { titulo, contenido, tags };
}

router.post("/publicar-noticia", requireAdmin, async (req, res) => {
  const { textoResultado, textoOriginal, fuente, imagenPortada } = req.body as {
    textoResultado?: string;
    textoOriginal?: string;
    fuente?: string;
    imagenPortada?: string;
  };

  if (!textoResultado || textoResultado.trim().length < 20) {
    res.status(400).json({ error: "Falta el texto de la noticia" });
    return;
  }

  try {
    const { titulo, contenido, tags } = parsearResultado(textoResultado);

    const [noticia] = await db
      .insert(noticiasTable)
      .values({
        titulo,
        contenido,
        tags,
        textoOriginal: textoOriginal ?? "",
        fuente: fuente ?? "",
        publicada: true,
        imagenPortada: imagenPortada ?? "",
      })
      .returning();

    // 🌐 Traducir al hebreo en background (fire-and-forget)
    traducirYGuardarHebreo(noticia.id).catch(() => {});

    res.json({ ok: true, id: noticia.id, titulo: noticia.titulo });
  } catch (err) {
    req.log.error({ err }, "Error publicando noticia");
    res.status(500).json({ error: "Error al guardar la noticia" });
  }
});

router.get("/noticia-pendiente/:id", requireAdminOrThisNoticia, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  try {
    const [noticia] = await db.select().from(noticiasTable).where(eq(noticiasTable.id, id)).limit(1);
    if (!noticia) { res.status(404).json({ error: "Noticia no encontrada" }); return; }
    res.json({ noticia });
  } catch (err) {
    req.log.error({ err }, "Error obteniendo noticia pendiente");
    res.status(500).json({ error: "Error al cargar la noticia" });
  }
});

router.put("/noticia-pendiente/:id", requireAdminOrThisNoticia, async (req, res) => {
  const id = parseInt(req.params.id);
  const { textoResultado, imagenPortada } = req.body as { textoResultado?: string; imagenPortada?: string };
  if (isNaN(id) || !textoResultado || textoResultado.trim().length < 10) {
    res.status(400).json({ error: "Faltan datos" }); return;
  }
  try {
    const { titulo, contenido, tags } = parsearResultado(textoResultado);
    const updateData: Record<string, unknown> = { titulo, contenido, tags, publicada: true, pendiente: false };
    if (imagenPortada && imagenPortada.startsWith("/objects/")) {
      updateData.imagenPortada = imagenPortada;
    }
    // Si cambia el contenido, invalidar traducción anterior para que se regenere
    updateData.tituloHe = "";
    updateData.contenidoHe = "";
    updateData.tagsHe = "";
    updateData.hebreoPublicada = false;

    const [updated] = await db
      .update(noticiasTable)
      .set(updateData)
      .where(eq(noticiasTable.id, id))
      .returning();

    // 🌐 Re-traducir al hebreo en background
    traducirYGuardarHebreo(updated.id).catch(() => {});

    res.json({ ok: true, noticia: updated });
  } catch (err) {
    req.log.error({ err }, "Error actualizando noticia");
    res.status(500).json({ error: "Error al actualizar la noticia" });
  }
});

router.get("/noticias-publicadas/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  try {
    const [noticia] = await db
      .select()
      .from(noticiasTable)
      .where(eq(noticiasTable.id, id))
      .limit(1);

    if (!noticia || !noticia.publicada) {
      res.status(404).json({ error: "Noticia no encontrada" });
      return;
    }
    res.json({ noticia });
  } catch (err) {
    req.log.error({ err }, "Error obteniendo noticia");
    res.status(500).json({ error: "Error al cargar la noticia" });
  }
});

router.get("/noticias-publicadas", async (req, res) => {
  try {
    const POR_PAGINA = 6;
    const page  = Math.max(0, parseInt(req.query.page  as string ?? "0") || 0);
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string ?? String(POR_PAGINA)) || POR_PAGINA));
    const offset = page * limit;
    const lang = (req.query.lang as string ?? "es").toLowerCase();
    const isHebreo = lang === "he";

    // Para hebreo: solo notas con traducción completa
    const whereClause = isHebreo
      ? and(
          eq(noticiasTable.publicada, true),
          eq(noticiasTable.hebreoPublicada, true),
          sql`length(coalesce(${noticiasTable.contenidoHe}, '')) > 100`,
        )
      : eq(noticiasTable.publicada, true);

    const [{ total }] = await db
      .select({ total: sqlRaw<number>`cast(count(*) as int)` })
      .from(noticiasTable)
      .where(whereClause);

    const rows = await db
      .select()
      .from(noticiasTable)
      .where(whereClause)
      .orderBy(desc(noticiasTable.createdAt))
      .limit(limit)
      .offset(offset);

    // Si es hebreo, mapear los campos *He a los nombres principales para que el frontend los consuma igual
    const noticias = isHebreo
      ? rows.map(n => ({
          ...n,
          titulo: n.tituloHe || n.titulo,
          contenido: n.contenidoHe || n.contenido,
          tags: n.tagsHe || n.tags,
        }))
      : rows;

    const totalPages = Math.max(1, Math.ceil(Number(total) / limit));

    delete req.headers["if-none-match"];
    delete req.headers["if-modified-since"];
    res.removeHeader("ETag");
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.set("Pragma", "no-cache");
    res.json({ noticias, total: Number(total), page, limit, totalPages, lang });
  } catch (err) {
    req.log.error({ err }, "Error obteniendo noticias");
    res.status(500).json({ error: "Error al cargar noticias" });
  }
});

router.delete("/noticias-publicadas/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  try {
    await db
      .update(noticiasTable)
      .set({ publicada: false })
      .where(eq(noticiasTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error despublicando noticia");
    res.status(500).json({ error: "Error al despublicar" });
  }
});

export default router;
