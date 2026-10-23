import { google } from "googleapis";
import type { User } from "@workspace/db";
import { decrypt } from "./crypto";

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export function getClientId() {
  return (
    process.env.GOOGLE_OAUTH_CID ||
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID
  );
}

export function getClientSecret() {
  return (
    process.env.GOOGLE_OAUTH_CSEC ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET
  );
}

export function getCallbackUrl() {
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    const primary = domains.split(",")[0].trim();
    return `https://${primary}/api/auth/google/callback`;
  }
  const domain = process.env.DOMAIN;
  if (domain) {
    return `https://${domain}/api/auth/google/callback`;
  }
  return `http://localhost:${process.env.PORT ?? 5000}/api/auth/google/callback`;
}

export function createOAuthClient(opts?: { withRedirect?: boolean }): OAuth2Client {
  return new google.auth.OAuth2(
    getClientId(),
    getClientSecret(),
    opts?.withRedirect ? getCallbackUrl() : undefined,
  );
}

export function oauthClientFromRefreshToken(refreshToken: string): OAuth2Client {
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

// One client per user so googleapis can reuse the access token between requests instead of refreshing every time.
const clientCache = new Map<number, { tokenEnc: string; client: OAuth2Client }>();

export function oauthClientForUser(user: User): OAuth2Client | null {
  if (!user.refreshTokenEnc) {
    clientCache.delete(user.id);
    return null;
  }
  const cached = clientCache.get(user.id);
  if (cached && cached.tokenEnc === user.refreshTokenEnc) return cached.client;
  const client = oauthClientFromRefreshToken(decrypt(user.refreshTokenEnc));
  clientCache.set(user.id, { tokenEnc: user.refreshTokenEnc, client });
  return client;
}

export function forgetOAuthClient(userId: number): void {
  clientCache.delete(userId);
}

export function isInvalidGrant(err: unknown): boolean {
  const e = err as { message?: string; response?: { data?: { error?: string } } };
  const msg = String(e?.message ?? "");
  const code = e?.response?.data?.error;
  return code === "invalid_grant" || msg.includes("invalid_grant");
}
