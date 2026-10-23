import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireUser, clearTokenCookie } from "../lib/session";
import { deleteUser } from "../lib/users";

const router = Router();

router.post("/account/accept-risk", requireUser, async (req, res) => {
  try {
    const [updated] = await db
      .update(usersTable)
      .set({ riskAcceptedAt: new Date(), updatedAt: new Date() })
      .where(eq(usersTable.id, req.user!.id))
      .returning();
    res.json({ riskAccepted: true, riskAcceptedAt: updated.riskAcceptedAt!.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to record risk acceptance");
    res.status(500).json({ error: "Failed to record acceptance" });
  }
});

router.delete("/account", requireUser, async (req, res) => {
  try {
    await deleteUser(req.user!);
    clearTokenCookie(res);
    req.log.info({ userId: req.user!.id }, "Account deleted");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete account");
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
