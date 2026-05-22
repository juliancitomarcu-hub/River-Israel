import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const suscriptoresTable = pgTable("suscriptores", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  email: text("email").notNull(),
  telefono: text("telefono").notNull().default(""),
  ciudad: text("ciudad").notNull().default(""),
  canales: text("canales").notNull().default("email"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSuscriptorSchema = createInsertSchema(suscriptoresTable).omit({
  id: true,
  createdAt: true,
});
export type InsertSuscriptor = z.infer<typeof insertSuscriptorSchema>;
export type Suscriptor = typeof suscriptoresTable.$inferSelect;
