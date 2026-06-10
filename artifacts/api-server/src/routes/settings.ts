import { Router } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getStoredRefreshToken, persistRefreshToken } from "../lib/account";

const router = Router();

export const MIN_INTERVAL_MINUTES = 1;
export const MAX_INTERVAL_MINUTES = 1440;

function requireAuth(req: any, res: any, next: any) {
  const session = req.session as any;
  if (!session.tokens) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

async function getOrCreateSettings() {
  const rows = await db.select().from(appSettingsTable).limit(1);
  if (rows.length > 0) return rows[0];
  const [created] = await db.insert(appSettingsTable).values({}).returning();
  return created;
}

function serialize(s: { autoPurgeEnabled: boolean; autoPurgeIntervalMinutes: number; lastRunAt: Date | null }) {
  return {
    autoPurgeEnabled: s.autoPurgeEnabled,
    autoPurgeIntervalMinutes: s.autoPurgeIntervalMinutes,
    lastRunAt: s.lastRunAt ? s.lastRunAt.toISOString() : null,
    minIntervalMinutes: MIN_INTERVAL_MINUTES,
    maxIntervalMinutes: MAX_INTERVAL_MINUTES,
  };
}

router.get("/settings", requireAuth, async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json(serialize(settings));
  } catch (err) {
    req.log.error({ err }, "Failed to get settings");
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.put("/settings", requireAuth, async (req, res) => {
  const session = req.session as any;
  try {
    const body = req.body ?? {};
    const enabled = Boolean(body.autoPurgeEnabled);

    let interval = Number(body.autoPurgeIntervalMinutes);
    if (!Number.isFinite(interval)) interval = 60;
    interval = Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, Math.round(interval)));

    if (enabled) {
      let refreshToken = await getStoredRefreshToken();
      if (!refreshToken && session.tokens?.refresh_token) {
        await persistRefreshToken(session.tokens.refresh_token, session.userInfo);
        refreshToken = session.tokens.refresh_token;
      }
      if (!refreshToken) {
        res.status(400).json({
          error: "no_refresh_token",
          message: "Please disconnect and reconnect Gmail to enable automatic purging.",
        });
        return;
      }
    }

    const settings = await getOrCreateSettings();
    const [updated] = await db
      .update(appSettingsTable)
      .set({ autoPurgeEnabled: enabled, autoPurgeIntervalMinutes: interval, updatedAt: new Date() })
      .where(eq(appSettingsTable.id, settings.id))
      .returning();

    res.json(serialize(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update settings");
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;
