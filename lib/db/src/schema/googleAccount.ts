import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const googleAccountTable = pgTable("google_account", {
  id: serial("id").primaryKey(),
  refreshToken: text("refresh_token").notNull(),
  email: text("email"),
  name: text("name"),
  picture: text("picture"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type GoogleAccount = typeof googleAccountTable.$inferSelect;
