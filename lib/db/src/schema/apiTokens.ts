import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Sign-in tokens for the web (httpOnly cookie) and the mobile apps (Bearer header). Only the SHA-256 hash is stored.
export const apiTokensTable = pgTable("api_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  client: text("client").notNull().default("web"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at").defaultNow().notNull(),
});

export type ApiToken = typeof apiTokensTable.$inferSelect;
