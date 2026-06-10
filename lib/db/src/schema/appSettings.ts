import { pgTable, serial, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const appSettingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  autoPurgeEnabled: boolean("auto_purge_enabled").notNull().default(false),
  autoPurgeIntervalMinutes: integer("auto_purge_interval_minutes").notNull().default(60),
  lastRunAt: timestamp("last_run_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AppSettings = typeof appSettingsTable.$inferSelect;
