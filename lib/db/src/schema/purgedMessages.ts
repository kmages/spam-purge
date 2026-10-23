import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// What got purged from Spam: sender and subject only, never the body. Pruned after 30 days.
export const purgedMessagesTable = pgTable(
  "purged_messages",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    sender: text("sender"),
    subject: text("subject"),
    purgedAt: timestamp("purged_at").defaultNow().notNull(),
  },
  (t) => [index("purged_messages_user_time").on(t.userId, t.purgedAt)],
);

export type PurgedMessage = typeof purgedMessagesTable.$inferSelect;
