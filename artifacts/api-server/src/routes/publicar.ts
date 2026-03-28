import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { noticiasTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router: IRouter = Router();

function parsearResultado(texto: string): { titulo: string; contenido: string; tags: string } {
  const tituloMatch = texto.match(/\*\*Título:\*\*\s*(.+)/);
  const tagsMatch = texto.match(/\*\*Tags:\*\*\s*(.+)/);

  const titulo = tituloMatch?.[1]?.trim() ?? "Sin título";
  const tags = tagsMatch?.[1]?.trim() ?? "#RiverPlate #RiverIsrael #RamatGan";

  const contenido = texto
    .replace(/\*\*Título:\*\*\s*.+\n?/, "")
    .replace(/\*\*Contenido:\*\*\s*\n?/, "")
    .replace(/\*\*Tags:\*\*\s*.+\n?/, "")
    .trim();

  return { titulo, contenido, tags };
}

router.post("/publicar-noticia", async (req, res) => {
  const { textoResultado, textoOriginal, fuente } = req.body as {
    textoResultado?: string;
    textoOriginal?: string;
    fuente?: string;
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
      })
      .returning();

    res.json({ ok: true, id: noticia.id, titulo: noticia.titulo });
  } catch (err) {
    req.log.error({ err }, "Error publicando noticia");
    res.status(500).json({ error: "Error al guardar la noticia" });
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
