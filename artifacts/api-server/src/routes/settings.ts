import { Router } from "express";
import { db, usersTable, type User } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireUser, SUBSCRIPTION_REQUIRED } from "../lib/session";
import { isEntitled } from "../lib/entitlement";

const router = Router();

export const MIN_INTERVAL_MINUTES = 1;
export const MAX_INTERVAL_MINUTES = 1440;
export const MAX_SPAM_DELAY_MINUTES = 7 * 24 * 60;

function serialize(u: User) {
  return {
    autoPurgeEnabled: u.autoPurgeEnabled,
    autoPurgeIntervalMinutes: u.autoPurgeIntervalMinutes,
    lastRunAt: u.lastRunAt ? u.lastRunAt.toISOString() : null,
    minIntervalMinutes: MIN_INTERVAL_MINUTES,
    maxIntervalMinutes: MAX_INTERVAL_MINUTES,
    purgeSpam: u.purgeSpam,
    purgeTrash: u.purgeTrash,
    spamDelayMinutes: u.spamDelayMinutes,
    maxSpamDelayMinutes: MAX_SPAM_DELAY_MINUTES,
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

router.get("/settings", requireUser, (req, res) => {
  res.json(serialize(req.user!));
});

// Fields left out of the body keep their current values.
router.put("/settings", requireUser, async (req, res) => {
  const user = req.user!;
  try {
    const body = req.body ?? {};
    const enabled = body.autoPurgeEnabled === undefined ? user.autoPurgeEnabled : Boolean(body.autoPurgeEnabled);

    if (enabled && !user.riskAcceptedAt) {
      res.status(403).json({
        error: "risk_not_accepted",
        message: "Purged mail is deleted permanently, including real mail Gmail misfiles as spam. Accept this first.",
      });
      return;
    }
    if (enabled && !user.autoPurgeEnabled && !isEntitled(user)) {
      res.status(402).json(SUBSCRIPTION_REQUIRED);
      return;
    }
    if (enabled && !user.refreshTokenEnc) {
      res.status(400).json({
        error: "no_refresh_token",
        message: "Please disconnect and reconnect Gmail to enable automatic purging.",
      });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({
        autoPurgeEnabled: enabled,
        autoPurgeIntervalMinutes: clampInt(
          body.autoPurgeIntervalMinutes,
          MIN_INTERVAL_MINUTES,
          MAX_INTERVAL_MINUTES,
          user.autoPurgeIntervalMinutes,
        ),
        purgeSpam: body.purgeSpam === undefined ? user.purgeSpam : Boolean(body.purgeSpam),
        purgeTrash: body.purgeTrash === undefined ? user.purgeTrash : Boolean(body.purgeTrash),
        spamDelayMinutes: clampInt(body.spamDelayMinutes, 0, MAX_SPAM_DELAY_MINUTES, user.spamDelayMinutes),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id))
      .returning();

    res.json(serialize(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update settings");
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;
