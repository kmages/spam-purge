import { db, usersTable, googleAccountTable, appSettingsTable, purgeRecordsTable } from "@workspace/db";
import { isNull } from "drizzle-orm";
import { encrypt } from "./crypto";
import { logger } from "./logger";

// One-time move from the single-user tables (google_account + app_settings) to users.
// The owner's existing account keeps its settings and history, and counts as having
// accepted the permanent-deletion risk since it was already running that way.
// Afterwards the plaintext refresh token is removed from google_account.
export async function migrateLegacyAccount(): Promise<void> {
  const [legacy] = await db.select().from(googleAccountTable).limit(1);
  if (!legacy) return;

  if (!legacy.email) {
    logger.warn("Legacy google_account row has no email; cannot migrate it. Sign in again to recreate the account.");
    await db.delete(googleAccountTable);
    return;
  }

  const [settings] = await db.select().from(appSettingsTable).limit(1);

  await db.transaction(async (tx) => {
    const values = {
      email: legacy.email!.toLowerCase(),
      name: legacy.name,
      picture: legacy.picture,
      refreshTokenEnc: encrypt(legacy.refreshToken),
      autoPurgeEnabled: settings?.autoPurgeEnabled ?? false,
      autoPurgeIntervalMinutes: settings?.autoPurgeIntervalMinutes ?? 60,
      lastRunAt: settings?.lastRunAt ?? null,
      riskAcceptedAt: new Date(),
      updatedAt: new Date(),
    };
    const [user] = await tx
      .insert(usersTable)
      .values(values)
      .onConflictDoUpdate({ target: usersTable.email, set: values })
      .returning();
    await tx.update(purgeRecordsTable).set({ userId: user.id }).where(isNull(purgeRecordsTable.userId));
    await tx.delete(googleAccountTable);
    logger.info({ userId: user.id, email: user.email }, "Migrated legacy single-user account");
  });
}
