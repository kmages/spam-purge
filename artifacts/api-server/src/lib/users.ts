import { db, usersTable, apiTokensTable, type User } from "@workspace/db";
import { eq } from "drizzle-orm";
import { encrypt } from "./crypto";
import { forgetOAuthClient, oauthClientForUser } from "./google";
import { logger } from "./logger";

interface GoogleProfile {
  email: string;
  name?: string | null;
  picture?: string | null;
}

// Google only returns a refresh token on consent, so keep the stored one when a sign-in comes back without it.
export async function upsertUserFromOAuth(
  profile: GoogleProfile,
  refreshToken: string | null | undefined,
): Promise<User> {
  const email = profile.email.toLowerCase();
  const values = {
    email,
    name: profile.name ?? null,
    picture: profile.picture ?? null,
    updatedAt: new Date(),
    ...(refreshToken ? { refreshTokenEnc: encrypt(refreshToken) } : {}),
  };
  const [user] = await db
    .insert(usersTable)
    .values(values)
    .onConflictDoUpdate({ target: usersTable.email, set: values })
    .returning();
  return user;
}

export async function getUser(id: number): Promise<User | null> {
  const rows = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  return rows[0] ?? null;
}

// Best effort: disconnect and account deletion must still go through when this fails.
async function revokeGoogleAccess(user: User): Promise<void> {
  try {
    const refreshToken = oauthClientForUser(user)?.credentials.refresh_token;
    if (refreshToken) await oauthClientForUser(user)!.revokeToken(refreshToken);
  } catch (err) {
    // Already revoked on Google's side, Google is unreachable, or the stored token no longer decrypts.
    // Dropping our copy still cuts off access from here.
    logger.warn({ err, userId: user.id }, "Google token revoke failed");
  }
  forgetOAuthClient(user.id);
}

// Stops all purging and drops the Google credential. The account row and its history stay.
export async function disconnectUser(user: User): Promise<void> {
  await revokeGoogleAccess(user);
  await db
    .update(usersTable)
    .set({ refreshTokenEnc: null, autoPurgeEnabled: false, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));
  await db.delete(apiTokensTable).where(eq(apiTokensTable.userId, user.id));
}

// Account deletion (required by both app stores). Cascades to tokens, allowlist, logs and history.
export async function deleteUser(user: User): Promise<void> {
  await revokeGoogleAccess(user);
  await db.delete(usersTable).where(eq(usersTable.id, user.id));
}

// Called when Google rejects the stored credential: the user revoked access or the grant expired.
export async function markCredentialInvalid(userId: number): Promise<void> {
  forgetOAuthClient(userId);
  await db
    .update(usersTable)
    .set({ refreshTokenEnc: null, autoPurgeEnabled: false, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));
}
