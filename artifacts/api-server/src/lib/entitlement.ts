import type { User } from "@workspace/db";

// RevenueCat identifies buyers by this id; the app logs in with it after sign-in.
export function appUserId(user: Pick<User, "id">): string {
  return `sp_${user.id}`;
}

export function userIdFromAppUserId(id: unknown): number | null {
  const m = typeof id === "string" ? /^sp_(\d+)$/.exec(id) : null;
  return m ? Number(m[1]) : null;
}

export function isEntitled(user: Pick<User, "compAccess" | "premiumUntil">, now = new Date()): boolean {
  return user.compAccess || (user.premiumUntil !== null && user.premiumUntil > now);
}
