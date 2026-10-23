import { pgTable, serial, text, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Senders whose spam is never purged. A pattern with "@" matches one address; otherwise it matches a domain and its subdomains.
export const allowlistTable = pgTable(
  "allowlist",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    pattern: text("pattern").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("allowlist_user_pattern").on(t.userId, t.pattern)],
);

export type AllowlistEntry = typeof allowlistTable.$inferSelect;
