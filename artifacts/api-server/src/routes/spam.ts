import { Router } from "express";
import { db, purgeRecordsTable, purgedMessagesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { isInvalidGrant } from "../lib/google";
import { markCredentialInvalid } from "../lib/users";
import { countPurgeable, purgeForUser, NotConnectedError } from "../lib/purge";
import { requireUser, requireRiskAccepted, requireEntitled } from "../lib/session";
import { isDemoUser, DEMO_COUNT, demoPurgeResult, demoHistory, demoLog } from "../lib/demo";

const router = Router();

const LOG_LIMIT = 200;

function gmailFailure(err: unknown, userId: number, res: any, fallback: string): Promise<void> | void {
  if (err instanceof NotConnectedError) {
    res.status(409).json({ error: "not_connected", message: "Reconnect Gmail to continue." });
    return;
  }
  if (isInvalidGrant(err)) {
    res.status(409).json({ error: "not_connected", message: "Google access was revoked. Reconnect Gmail to continue." });
    return markCredentialInvalid(userId);
  }
  res.status(500).json({ error: fallback });
}

router.get("/spam/count", requireUser, async (req, res) => {
  if (isDemoUser(req.user)) {
    res.json(DEMO_COUNT);
    return;
  }
  try {
    const counts = await countPurgeable(req.user!);
    res.json({ ...counts, sizeBytes: null });
  } catch (err) {
    req.log.error({ err }, "Failed to get spam count");
    await gmailFailure(err, req.user!.id, res, "Failed to fetch spam count");
  }
});

router.post("/spam/purge", requireUser, requireRiskAccepted, requireEntitled, async (req, res) => {
  if (isDemoUser(req.user)) {
    res.json(demoPurgeResult());
    return;
  }
  try {
    const outcome = await purgeForUser(req.user!, "manual");
    req.log.info({ userId: req.user!.id, ...outcome }, "Spam & trash purge complete");
    const { deleted } = outcome;
    res.json({
      ...outcome,
      success: true,
      message: `Permanently deleted ${deleted} spam & trash message${deleted !== 1 ? "s" : ""}`,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to purge spam");
    await gmailFailure(err, req.user!.id, res, "Failed to purge spam");
  }
});

router.get("/spam/history", requireUser, async (req, res) => {
  if (isDemoUser(req.user)) {
    res.json(demoHistory());
    return;
  }
  try {
    const records = await db
      .select()
      .from(purgeRecordsTable)
      .where(eq(purgeRecordsTable.userId, req.user!.id))
      .orderBy(desc(purgeRecordsTable.purgedAt))
      .limit(20);

    res.json(records.map((r) => ({
      id: r.id,
      deletedCount: r.deletedCount,
      purgedAt: r.purgedAt.toISOString(),
      durationMs: r.durationMs ?? null,
      source: r.source,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get purge history");
    res.status(500).json({ error: "Failed to fetch purge history" });
  }
});

// Sender and subject of spam purged in the last 30 days, newest first.
router.get("/spam/log", requireUser, async (req, res) => {
  if (isDemoUser(req.user)) {
    res.json(demoLog());
    return;
  }
  try {
    const rows = await db
      .select()
      .from(purgedMessagesTable)
      .where(eq(purgedMessagesTable.userId, req.user!.id))
      .orderBy(desc(purgedMessagesTable.purgedAt))
      .limit(LOG_LIMIT);
    res.json(rows.map((r) => ({ id: r.id, sender: r.sender, subject: r.subject, purgedAt: r.purgedAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Failed to get purge log");
    res.status(500).json({ error: "Failed to fetch purge log" });
  }
});

export default router;
