import { pgTable, integer, text, timestamp } from "drizzle-orm/pg-core";
import { noticiasTable } from "./noticias";

// Internal delivery state, separate from public news responses.
export const instagramPublicacionesTable = pgTable("instagram_publicaciones", {
  noticiaId: integer("noticia_id").primaryKey().references(() => noticiasTable.id, { onDelete: "cascade" }),
  categoria: text("categoria").notNull(),
  estado: text("estado").notNull().default("pendiente"),
  caption: text("caption"), imagenUrl: text("imagen_url"), cuentaId: text("cuenta_id"),
  containerId: text("container_id"), mediaId: text("media_id"), error: text("error"),
  intentos: integer("intentos").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
});
