import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { decide, type RevenueCatEvent } from "../lib/subscription";
import { userIdFromAppUserId } from "../lib/entitlement";
import { logger } from "../lib/logger";

// RevenueCat posts here when an App Store or Google Play subscription starts, renews or ends.
// Fails closed: without REVENUECAT_WEBHOOK_SECRET every call is refused, otherwise anyone could
// post a fake purchase and get purging for free.

const router = Router();

function authorized(header: string | undefined, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const given = Buffer.from(header);
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

async function applyTo(userId: number, event: RevenueCatEvent): Promise<void> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    logger.info({ userId, type: event.type }, "RevenueCat webhook: account no longer exists");
    return;
  }
  const decision = decide(event, user);
  if (decision.action === "ignore") {
    logger.info({ userId, type: event.type, reason: decision.reason }, "RevenueCat webhook ignored");
    return;
  }
  await db
    .update(usersTable)
    .set({ premiumUntil: decision.premiumUntil, premiumEventAt: decision.premiumEventAt, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));
  logger.info({ userId, type: event.type, premiumUntil: decision.premiumUntil }, "RevenueCat webhook applied");
}

router.post("/webhooks/revenuecat", async (req, res) => {
  if (!authorized(req.headers.authorization, process.env.REVENUECAT_WEBHOOK_SECRET)) {
    res.status(401).send("Unauthorized");
    return;
  }
  const event = (req.body?.event ?? {}) as RevenueCatEvent;
  try {
    if (event.type === "TRANSFER") {
      // The purchase moved to another account (e.g. Restore on a new sign-in). The new owner's
      // access arrives with their next event; the old owner loses it now.
      const to = new Set(event.transferred_to ?? []);
      for (const from of event.transferred_from ?? []) {
        const id = userIdFromAppUserId(from);
        if (id !== null && !to.has(from)) await applyTo(id, { ...event, type: "EXPIRATION", expiration_at_ms: Date.now() });
      }
    } else {
      const id = userIdFromAppUserId(event.app_user_id);
      if (id === null) {
        // Anonymous RevenueCat ids ($RCAnonymousID:...) have no account to unlock.
        logger.info({ type: event.type }, "RevenueCat webhook: not a SPAM Purge account id");
      } else {
        await applyTo(id, event);
      }
    }
    res.status(200).send("OK");
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : "unknown" }, "RevenueCat webhook failed");
    res.status(500).send("Error"); // RevenueCat retries on 5xx
  }
});

export default router;
