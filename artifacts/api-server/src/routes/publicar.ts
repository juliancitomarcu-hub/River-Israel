import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { noticiasTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router: IRouter = Router();

function parsearResultado(texto: string): { titulo: string; contenido: string; tags: string } {
  let tituloMatch =
    texto.match(/\*\*Título:\*\*\s*([^\n*][^\n]+)/) ??
    texto.match(/\*\*Título:\*\*\s*\n+\s*([^\n*][^\n]+)/);

  let tituloEsNegrita = false;
  if (!tituloMatch) {
    const primeraNegraMatch = texto.match(/^\s*\*\*([^*\n]+)\*\*/m);
    if (primeraNegraMatch) {
      tituloMatch = primeraNegraMatch;
      tituloEsNegrita = true;
    }
  }

  const bajadaMatch =
    texto.match(/\*\*Bajada:\*\*\s*([^\n*][^\n]+)/) ??
    texto.match(/\*\*Bajada:\*\*\s*\n+\s*([^\n*][^\n]+)/);
  const tagsMatch =
    texto.match(/\*\*Tags:\*\*\s*([^\n]+)/) ??
    texto.match(/\*\*Tags:\*\*\s*\n+\s*([^\n]+)/);

  const titulo = tituloMatch?.[1]?.trim() ?? "Sin título";
  const bajada = bajadaMatch?.[1]?.trim() ?? "";
  const tags = tagsMatch?.[1]?.trim() ?? "#RiverPlate #RiverIsrael #RamatGan #ElMasGrande";

  let contenido = texto
    .replace(/\*\*Título:\*\*.*?(\n|$)/gs, "")
    .replace(/\*\*Bajada:\*\*.*?(\n|$)/gs, "")
    .replace(/\*\*Contenido:\*\*\s*\n?/, "")
    .replace(/\*\*Tags:\*\*.*?(\n|$)/gs, "")
    .trim();

  if (tituloEsNegrita && titulo !== "Sin título") {
    contenido = contenido.replace(`**${titulo}**`, "").replace(/^\n+/, "").trim();
  }

  if (bajada) {
    contenido = `*${bajada}*\n\n${contenido}`;
  }

  return { titulo, contenido, tags };
}

router.post("/publicar-noticia", async (req, res) => {
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

    res.json({ ok: true, id: noticia.id, titulo: noticia.titulo });
  } catch (err) {
    req.log.error({ err }, "Error publicando noticia");
    res.status(500).json({ error: "Error al guardar la noticia" });
  }
});

router.get("/noticia-pendiente/:id", async (req, res) => {
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

router.put("/noticia-pendiente/:id", async (req, res) => {
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
    const [updated] = await db
      .update(noticiasTable)
      .set(updateData)
      .where(eq(noticiasTable.id, id))
      .returning();
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
    const noticias = await db
      .select()
      .from(noticiasTable)
      .where(eq(noticiasTable.publicada, true))
      .orderBy(desc(noticiasTable.createdAt))
      .limit(20);

    // Eliminar cabeceras condicionales para evitar respuestas 304 en caché
    delete req.headers["if-none-match"];
    delete req.headers["if-modified-since"];
    res.removeHeader("ETag");
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.set("Pragma", "no-cache");
    res.json({ noticias });
  } catch (err) {
    req.log.error({ err }, "Error obteniendo noticias");
    res.status(500).json({ error: "Error al cargar noticias" });
  }
});

router.delete("/noticias-publicadas/:id", async (req, res) => {
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
