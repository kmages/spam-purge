import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { oauthClientFromRefreshToken } from "./google";
import { getStoredRefreshToken, clearStoredAccount } from "./account";
import { purgeAllSpam } from "./purge";
import { logger } from "./logger";

const TICK_INTERVAL_MS = 30 * 1000;

let running = false;

function isInvalidGrant(err: unknown): boolean {
  const e = err as { message?: string; response?: { data?: { error?: string } } };
  const msg = String(e?.message ?? "");
  const code = e?.response?.data?.error;
  return code === "invalid_grant" || msg.includes("invalid_grant");
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;

  const rows = await db.select().from(appSettingsTable).limit(1);
  const settings = rows[0];

  try {
    if (!settings || !settings.autoPurgeEnabled) return;

    const intervalMs = settings.autoPurgeIntervalMinutes * 60 * 1000;
    const lastRun = settings.lastRunAt ? settings.lastRunAt.getTime() : 0;
    if (Date.now() - lastRun < intervalMs) return;

    const refreshToken = await getStoredRefreshToken();
    if (!refreshToken) {
      logger.warn("Auto-purge is enabled but no stored Google credentials are available; disabling");
      await db
        .update(appSettingsTable)
        .set({ autoPurgeEnabled: false })
        .where(eq(appSettingsTable.id, settings.id));
      return;
    }

    const auth = oauthClientFromRefreshToken(refreshToken);
    const { deleted, durationMs } = await purgeAllSpam(auth, "auto");
    await db
      .update(appSettingsTable)
      .set({ lastRunAt: new Date() })
      .where(eq(appSettingsTable.id, settings.id));

    logger.info({ deleted, durationMs }, "Auto-purge completed");
  } catch (err) {
    if (settings) {
      if (isInvalidGrant(err)) {
        // Token was revoked/expired: stop retrying and require a reconnect.
        await db
          .update(appSettingsTable)
          .set({ autoPurgeEnabled: false })
          .where(eq(appSettingsTable.id, settings.id));
        await clearStoredAccount();
        logger.error("Auto-purge disabled: Google refresh token is invalid; reconnect required");
      } else {
        // Transient failure: back off until the next configured interval instead of retrying every tick.
        await db
          .update(appSettingsTable)
          .set({ lastRunAt: new Date() })
          .where(eq(appSettingsTable.id, settings.id));
        logger.error({ err }, "Auto-purge tick failed; backing off until next interval");
      }
    } else {
      logger.error({ err }, "Auto-purge tick failed");
    }
  } finally {
    running = false;
  }
}

export function startScheduler(): void {
  if (process.env.NODE_ENV !== "production") {
    logger.info("Auto-purge scheduler is disabled outside production");
    return;
  }
  setInterval(() => {
    void tick();
  }, TICK_INTERVAL_MS);
  logger.info("Auto-purge scheduler started");
}
