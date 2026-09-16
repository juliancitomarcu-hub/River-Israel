import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Estado clave-valor persistente de la aplicación.
 * Reemplaza los archivos JSON locales (scheduler_state.json, redactor_settings.json)
 * que se perdían con cada reinicio del servidor en producción.
 */
export const appEstadoTable = pgTable("app_estado", {
  clave: text("clave").primaryKey(),
  valor: jsonb("valor").notNull(),
  actualizadoEn: timestamp("actualizado_en").notNull().defaultNow(),
});
