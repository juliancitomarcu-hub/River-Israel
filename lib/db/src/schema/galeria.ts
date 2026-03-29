import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const galeriaTable = pgTable("galeria", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  caption: text("caption").notNull().default(""),
  orden: integer("orden").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGaleriaSchema = createInsertSchema(galeriaTable).omit({ id: true, createdAt: true });
export type InsertGaleria = z.infer<typeof insertGaleriaSchema>;
export type GaleriaFoto = typeof galeriaTable.$inferSelect;
