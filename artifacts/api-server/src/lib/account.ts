import { db, googleAccountTable } from "@workspace/db";
import { eq } from "drizzle-orm";

interface UserInfo {
  email?: string | null;
  name?: string | null;
  picture?: string | null;
}

export async function persistRefreshToken(
  refreshToken: string | null | undefined,
  userInfo?: UserInfo,
): Promise<void> {
  if (!refreshToken) return;

  const existing = await db.select().from(googleAccountTable).limit(1);
  const values = {
    refreshToken,
    email: userInfo?.email ?? null,
    name: userInfo?.name ?? null,
    picture: userInfo?.picture ?? null,
    updatedAt: new Date(),
  };

  if (existing.length > 0) {
    await db
      .update(googleAccountTable)
      .set(values)
      .where(eq(googleAccountTable.id, existing[0].id));
  } else {
    await db.insert(googleAccountTable).values(values);
  }
}

export async function getStoredRefreshToken(): Promise<string | null> {
  const rows = await db.select().from(googleAccountTable).limit(1);
  return rows[0]?.refreshToken ?? null;
}

export async function clearStoredAccount(): Promise<void> {
  await db.delete(googleAccountTable);
}
