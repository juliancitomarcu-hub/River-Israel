import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const videosTable = pgTable("videos_galeria", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  titulo: text("titulo").notNull().default(""),
  thumbnail: text("thumbnail"),
  orden: integer("orden").notNull().default(0),
  categoria: text("categoria").notNull().default("river"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertVideoSchema = createInsertSchema(videosTable).omit({ id: true, createdAt: true });
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type VideoGaleria = typeof videosTable.$inferSelect;
