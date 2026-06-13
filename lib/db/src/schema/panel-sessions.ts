import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

// Sesiones del panel (admin + scoped por noticia). Antes vivían en `Map` en
// memoria y se borraban en cada reinicio/deploy del API server. Ahora viven en
// la DB para que sobrevivan reinicios y se pueda escalar a más de una instancia.
//
// scope:
//   - "admin"   → sesión completa de admin (login con contraseña o link de
//                 resumen). noticiaId es null.
//   - "noticia" → sesión efímera scoped a una sola noticia (link de Telegram).
//                 noticiaId apunta a la nota editable.
export const panelSessionsTable = pgTable("panel_sessions", {
  token: text("token").primaryKey(),
  scope: text("scope").notNull(),
  noticiaId: integer("noticia_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PanelSessionRow = typeof panelSessionsTable.$inferSelect;
