import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  picture: text("picture"),
  // AES-256-GCM ciphertext (see api-server lib/crypto.ts). Null once disconnected.
  refreshTokenEnc: text("refresh_token_enc"),
  autoPurgeEnabled: boolean("auto_purge_enabled").notNull().default(false),
  autoPurgeIntervalMinutes: integer("auto_purge_interval_minutes").notNull().default(60),
  purgeSpam: boolean("purge_spam").notNull().default(true),
  purgeTrash: boolean("purge_trash").notNull().default(true),
  // Spam younger than this is left alone so the user can glance at it first. 0 = purge immediately.
  spamDelayMinutes: integer("spam_delay_minutes").notNull().default(0),
  // Set when the user acknowledges that purged mail, including misfiled real mail, is gone forever.
  riskAcceptedAt: timestamp("risk_accepted_at"),
  lastRunAt: timestamp("last_run_at"),
  // Subscription, mirrored from RevenueCat webhooks: entitled while premiumUntil is in the future.
  premiumUntil: timestamp("premium_until"),
  // Time of the newest RevenueCat event applied, so a late-arriving older event can't undo a newer one.
  premiumEventAt: timestamp("premium_event_at"),
  // Free access granted by hand (the owner, friends). Never touched by webhooks.
  compAccess: boolean("comp_access").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof usersTable.$inferSelect;
