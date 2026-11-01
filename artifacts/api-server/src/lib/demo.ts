import { db, usersTable, type User } from "@workspace/db";
import { encrypt } from "./crypto";

// A single, fixed account used only by App Store / Google Play reviewers. It is entitled via comp
// access and has the risk already accepted, so the app lands straight on the dashboard with no Google
// sign-in and no paywall. No Gmail call is ever made for it: count, purge and history are canned below.
export const DEMO_EMAIL = "appreview@demo.spam-purge.com";

export function isDemoUser(user: Pick<User, "email"> | undefined | null): boolean {
  return !!user && user.email === DEMO_EMAIL;
}

// What the reviewer sees on the dashboard. Realistic, but no real mailbox is touched.
export const DEMO_COUNT = { count: 1284, spam: 1193, trash: 91, sizeBytes: 48234496 };

export function demoPurgeResult() {
  return {
    deleted: 0,
    spamDeleted: 0,
    trashDeleted: 0,
    spamKept: 0,
    durationMs: 0,
    success: true,
    message: "Demo account: nothing was deleted. On a real Gmail account this permanently deletes Spam and Trash.",
  };
}

export function demoHistory() {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const rows = [
    { deletedCount: 1284, source: "auto", durationMs: 2410 },
    { deletedCount: 866, source: "auto", durationMs: 1980 },
    { deletedCount: 1902, source: "manual", durationMs: 3120 },
    { deletedCount: 744, source: "auto", durationMs: 1610 },
  ];
  return rows.map((r, i) => ({
    id: i + 1,
    deletedCount: r.deletedCount,
    purgedAt: new Date(now - i * day).toISOString(),
    durationMs: r.durationMs,
    source: r.source,
  }));
}

export function demoLog() {
  const hour = 60 * 60 * 1000;
  const now = Date.now();
  const items = [
    { sender: "deals@shopnowdaily.example", subject: "Your exclusive 70% OFF ends tonight" },
    { sender: "winner@prize-claims.example", subject: "You have been selected" },
    { sender: "alerts@secure-verify.example", subject: "Unusual sign-in attempt, confirm now" },
    { sender: "newsletter@crypto-signals.example", subject: "This coin is about to 100x" },
    { sender: "support@account-billing.example", subject: "Your invoice is overdue" },
    { sender: "no-reply@mega-sweepstakes.example", subject: "Final notice: claim your reward" },
  ];
  return items.map((m, i) => ({
    id: i + 1,
    sender: m.sender,
    subject: m.subject,
    purgedAt: new Date(now - i * hour).toISOString(),
  }));
}

// Lazily create (or re-arm) the demo account. Safe to call on every demo sign-in.
export async function ensureDemoUser(): Promise<User> {
  const armed = { compAccess: true, riskAcceptedAt: new Date(), updatedAt: new Date() };
  const [user] = await db
    .insert(usersTable)
    .values({
      email: DEMO_EMAIL,
      name: "App Review",
      picture: null,
      // Placeholder so /auth/status reports connected: true. Never used to reach Gmail.
      refreshTokenEnc: encrypt("demo-placeholder"),
      autoPurgeEnabled: false,
      autoPurgeIntervalMinutes: 60,
      purgeSpam: true,
      purgeTrash: true,
      spamDelayMinutes: 0,
      ...armed,
    })
    .onConflictDoUpdate({ target: usersTable.email, set: armed })
    .returning();
  return user;
}

