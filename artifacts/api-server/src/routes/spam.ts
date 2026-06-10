import { Router } from "express";
import { db, purgeRecordsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { oauthClientFromTokens } from "../lib/google";
import { countSpam, purgeAllSpam } from "../lib/purge";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  const session = req.session as any;
  if (!session.tokens) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

router.get("/spam/count", requireAuth, async (req, res) => {
  const session = req.session as any;
  try {
    const auth = oauthClientFromTokens(session.tokens);
    const count = await countSpam(auth);
    res.json({ count, sizeBytes: null });
  } catch (err) {
    req.log.error({ err }, "Failed to get spam count");
    res.status(500).json({ error: "Failed to fetch spam count" });
  }
});

router.post("/spam/purge", requireAuth, async (req, res) => {
  const session = req.session as any;
  try {
    const auth = oauthClientFromTokens(session.tokens);
    const { deleted } = await purgeAllSpam(auth, "manual");
    req.log.info({ deleted }, "Spam purge complete");
    res.json({ deleted, success: true, message: `Permanently deleted ${deleted} spam message${deleted !== 1 ? "s" : ""}` });
  } catch (err) {
    req.log.error({ err }, "Failed to purge spam");
    res.status(500).json({ error: "Failed to purge spam" });
  }
});

router.get("/spam/history", requireAuth, async (req, res) => {
  try {
    const records = await db
      .select()
      .from(purgeRecordsTable)
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

export default router;
