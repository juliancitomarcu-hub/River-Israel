import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const visitasTable = pgTable("visitas", {
  id: serial("id").primaryKey(),
  total: integer("total").notNull().default(0),
  unicas: integer("unicas").notNull().default(0),
  actualizadoEn: timestamp("actualizado_en").notNull().defaultNow(),
});

export type Visitas = typeof visitasTable.$inferSelect;
