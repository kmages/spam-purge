import { db, usersTable, purgedMessagesTable } from "@workspace/db";
import { and, eq, ne, isNotNull, lt, or, gt, sql } from "drizzle-orm";
import { isInvalidGrant } from "./google";
import { markCredentialInvalid } from "./users";
import { purgeForUser } from "./purge";
import { DEMO_EMAIL } from "./demo";
import { logger } from "./logger";

const TICK_INTERVAL_MS = 30 * 1000;
const LOG_RETENTION_DAYS = 30;
const PRUNE_INTERVAL_MS = 60 * 60 * 1000;

let running = false;
let lastPruneAt = 0;

async function dueUsers() {
  return db
    .select()
    .from(usersTable)
    .where(
      and(
        ne(usersTable.email, DEMO_EMAIL),
        eq(usersTable.autoPurgeEnabled, true),
        isNotNull(usersTable.refreshTokenEnc),
        isNotNull(usersTable.riskAcceptedAt),
        or(eq(usersTable.compAccess, true), gt(usersTable.premiumUntil, sql`now()`)),
        sql`(${usersTable.lastRunAt} is null or ${usersTable.lastRunAt} + ${usersTable.autoPurgeIntervalMinutes} * interval '1 minute' <= now())`,
      ),
    )
    .orderBy(usersTable.lastRunAt);
}

async function pruneLogs(): Promise<void> {
  if (Date.now() - lastPruneAt < PRUNE_INTERVAL_MS) return;
  lastPruneAt = Date.now();
  await db
    .delete(purgedMessagesTable)
    .where(lt(purgedMessagesTable.purgedAt, sql`now() - ${LOG_RETENTION_DAYS} * interval '1 day'`));
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await pruneLogs();
    // Sequential on purpose: the user base is capped at 100 and this keeps Gmail quota use predictable.
    for (const user of await dueUsers()) {
      try {
        const outcome = await purgeForUser(user, "auto");
        logger.info({ userId: user.id, ...outcome }, "Auto-purge completed");
      } catch (err) {
        if (isInvalidGrant(err)) {
          // Token was revoked/expired: stop retrying and require a reconnect.
          await markCredentialInvalid(user.id);
          logger.error({ userId: user.id }, "Auto-purge disabled: Google refresh token is invalid; reconnect required");
          continue;
        }
        logger.error({ err, userId: user.id }, "Auto-purge failed; backing off until next interval");
      }
      // Set on failure too, so a transient error backs off for one interval instead of retrying every tick.
      await db.update(usersTable).set({ lastRunAt: new Date() }).where(eq(usersTable.id, user.id));
    }
  } catch (err) {
    logger.error({ err }, "Auto-purge tick failed");
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
