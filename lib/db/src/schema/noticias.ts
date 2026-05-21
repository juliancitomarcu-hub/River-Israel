import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const noticiasTable = pgTable("noticias", {
  id: serial("id").primaryKey(),
  titulo: text("titulo").notNull(),
  contenido: text("contenido").notNull(),
  tags: text("tags").notNull().default(""),
  textoOriginal: text("texto_original").notNull().default(""),
  fuente: text("fuente").notNull().default(""),
  publicada: boolean("publicada").notNull().default(false),
  pendiente: boolean("pendiente").notNull().default(false),
  telegramMessageId: text("telegram_message_id").default(""),
  imagenPortada: text("imagen_portada").default(""),
  tituloHe: text("titulo_he").default(""),
  contenidoHe: text("contenido_he").default(""),
  tagsHe: text("tags_he").default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNoticiaSchema = createInsertSchema(noticiasTable).omit({ id: true, createdAt: true });
export type InsertNoticia = z.infer<typeof insertNoticiaSchema>;
export type Noticia = typeof noticiasTable.$inferSelect;
