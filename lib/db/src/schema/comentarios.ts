import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { noticiasTable } from "./noticias";

export const comentariosTable = pgTable("comentarios", {
  id: serial("id").primaryKey(),
  noticiaId: integer("noticia_id")
    .notNull()
    .references(() => noticiasTable.id, { onDelete: "cascade" }),
  autor: text("autor").notNull().default("Anónimo"),
  contenido: text("contenido").notNull(),
  oculto: boolean("oculto").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertComentarioSchema = createInsertSchema(comentariosTable).omit({
  id: true,
  oculto: true,
  createdAt: true,
});
export type InsertComentario = z.infer<typeof insertComentarioSchema>;
export type Comentario = typeof comentariosTable.$inferSelect;
