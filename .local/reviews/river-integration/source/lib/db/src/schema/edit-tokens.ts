import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const editTokensTable = pgTable("edit_tokens", {
  token: text("token").primaryKey(),
  noticiaId: integer("noticia_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EditTokenRow = typeof editTokensTable.$inferSelect;
