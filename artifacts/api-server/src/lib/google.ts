import { google } from "googleapis";

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
  return `http://localhost:${process.env.PORT ?? 5000}/api/auth/google/callback`;
}

export function createOAuthClient(opts?: { withRedirect?: boolean }): OAuth2Client {
  return new google.auth.OAuth2(
    getClientId(),
    getClientSecret(),
    opts?.withRedirect ? getCallbackUrl() : undefined,
  );
}

export function oauthClientFromTokens(tokens: unknown): OAuth2Client {
  const client = createOAuthClient();
  client.setCredentials(tokens as Record<string, unknown>);
  return client;
}

export function oauthClientFromRefreshToken(refreshToken: string): OAuth2Client {
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}
