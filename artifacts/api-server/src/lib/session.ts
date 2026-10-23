import type { Request, Response, NextFunction } from "express";
import { db, apiTokensTable, usersTable, type User } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomToken, sha256 } from "./crypto";

export const TOKEN_COOKIE = "sp_token";
const TOKEN_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const LAST_USED_RESOLUTION_MS = 60 * 60 * 1000;

export type ClientKind = "web" | "mobile";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      apiTokenId?: number;
    }
  }
}

export async function issueApiToken(userId: number, client: ClientKind): Promise<string> {
  const token = randomToken();
  await db.insert(apiTokensTable).values({ userId, tokenHash: sha256(token), client });
  return token;
}

export function setTokenCookie(res: Response, token: string): void {
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TOKEN_COOKIE_MAX_AGE_MS,
    path: "/",
  });
}

export function clearTokenCookie(res: Response): void {
  res.clearCookie(TOKEN_COOKIE, { path: "/" });
}

function tokenFromRequest(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length).trim() || null;
  const cookie = (req as Request & { cookies?: Record<string, string> }).cookies?.[TOKEN_COOKIE];
  return cookie || null;
}

// Populates req.user when a valid token is present. Never rejects; see requireUser.
export async function loadUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = tokenFromRequest(req);
  if (!token) return next();
  try {
    const rows = await db
      .select({ token: apiTokensTable, user: usersTable })
      .from(apiTokensTable)
      .innerJoin(usersTable, eq(apiTokensTable.userId, usersTable.id))
      .where(eq(apiTokensTable.tokenHash, sha256(token)))
      .limit(1);
    const row = rows[0];
    if (row) {
      req.user = row.user;
      req.apiTokenId = row.token.id;
      if (Date.now() - row.token.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
        await db.update(apiTokensTable).set({ lastUsedAt: new Date() }).where(eq(apiTokensTable.id, row.token.id));
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

// Purging is irreversible, so no purge runs until the user has acknowledged that.
export function requireRiskAccepted(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.riskAcceptedAt) {
    res.status(403).json({
      error: "risk_not_accepted",
      message: "Purged mail is deleted permanently, including real mail Gmail misfiles as spam. Accept this first.",
    });
    return;
  }
  next();
}
