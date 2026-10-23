import { Router } from "express";
import { db, allowlistTable } from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";
import { requireUser } from "../lib/session";
import { normalizeAllowlistPattern } from "../lib/purge";

const router = Router();

const MAX_ENTRIES = 500;

function serialize(e: { id: number; pattern: string; createdAt: Date }) {
  return { id: e.id, pattern: e.pattern, createdAt: e.createdAt.toISOString() };
}

router.get("/allowlist", requireUser, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(allowlistTable)
      .where(eq(allowlistTable.userId, req.user!.id))
      .orderBy(asc(allowlistTable.pattern));
    res.json(rows.map(serialize));
  } catch (err) {
    req.log.error({ err }, "Failed to get allowlist");
    res.status(500).json({ error: "Failed to fetch allowlist" });
  }
});

router.post("/allowlist", requireUser, async (req, res) => {
  const pattern = normalizeAllowlistPattern(String(req.body?.pattern ?? ""));
  if (!pattern) {
    res.status(400).json({ error: "invalid_pattern", message: "Enter an email address or a domain like example.com." });
    return;
  }
  try {
    const existing = await db.select({ id: allowlistTable.id }).from(allowlistTable).where(eq(allowlistTable.userId, req.user!.id));
    if (existing.length >= MAX_ENTRIES) {
      res.status(400).json({ error: "allowlist_full", message: `The allowlist holds up to ${MAX_ENTRIES} entries.` });
      return;
    }
    const [row] = await db
      .insert(allowlistTable)
      .values({ userId: req.user!.id, pattern })
      .onConflictDoNothing()
      .returning();
    if (row) {
      res.status(201).json(serialize(row));
      return;
    }
    const [dupe] = await db
      .select()
      .from(allowlistTable)
      .where(and(eq(allowlistTable.userId, req.user!.id), eq(allowlistTable.pattern, pattern)));
    res.json(serialize(dupe));
  } catch (err) {
    req.log.error({ err }, "Failed to add allowlist entry");
    res.status(500).json({ error: "Failed to add allowlist entry" });
  }
});

router.delete("/allowlist/:id", requireUser, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "invalid_id" });
    return;
  }
  try {
    const deleted = await db
      .delete(allowlistTable)
      .where(and(eq(allowlistTable.id, id), eq(allowlistTable.userId, req.user!.id)))
      .returning({ id: allowlistTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete allowlist entry");
    res.status(500).json({ error: "Failed to delete allowlist entry" });
  }
});

export default router;
