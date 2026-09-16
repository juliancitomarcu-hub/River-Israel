import { pgTable, serial, text, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
  imagenInstagram: text("imagen_instagram").default(""),
  tituloHe: text("titulo_he").default(""),
  contenidoHe: text("contenido_he").default(""),
  tagsHe: text("tags_he").default(""),
  hebreoPublicada: boolean("hebreo_publicada").notNull().default(false),
  categoria: text("categoria").notNull().default("river"),
  // URL canónica (normalizada) del artículo fuente — dedupe permanente:
  // el scheduler nunca vuelve a procesar una URL que ya está en la tabla.
  urlFuente: text("url_fuente").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  // Único a nivel DB (solo para URLs no vacías): garantía dura contra
  // duplicados incluso ante condiciones de carrera o reintentos.
  uniqueIndex("noticias_url_fuente_unq")
    .on(t.urlFuente)
    .where(sql`url_fuente <> ''`),
]);

export const insertNoticiaSchema = createInsertSchema(noticiasTable).omit({ id: true, createdAt: true });
export type InsertNoticia = z.infer<typeof insertNoticiaSchema>;
export type Noticia = typeof noticiasTable.$inferSelect;
