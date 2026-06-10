import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const purgeRecordsTable = pgTable("purge_records", {
  id: serial("id").primaryKey(),
  deletedCount: integer("deleted_count").notNull(),
  durationMs: integer("duration_ms"),
  source: text("source").notNull().default("manual"),
  purgedAt: timestamp("purged_at").defaultNow().notNull(),
});

export const insertPurgeRecordSchema = createInsertSchema(purgeRecordsTable).omit({ id: true, purgedAt: true });
export type InsertPurgeRecord = z.infer<typeof insertPurgeRecordSchema>;
export type PurgeRecord = typeof purgeRecordsTable.$inferSelect;
