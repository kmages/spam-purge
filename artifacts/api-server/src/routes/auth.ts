import { Router } from "express";
import crypto from "crypto";
import { google } from "googleapis";
import { db, apiTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { createOAuthClient, getClientId, getClientSecret } from "../lib/google";
import { upsertUserFromOAuth, disconnectUser } from "../lib/users";
import { issueApiToken, setTokenCookie, clearTokenCookie } from "../lib/session";
import { randomToken } from "../lib/crypto";
import { appUserId, isEntitled } from "../lib/entitlement";
import { ensureDemoUser } from "../lib/demo";

const router = Router();

const GMAIL_SCOPE = "https://mail.google.com/";
const SCOPES = [GMAIL_SCOPE, "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"];

// Mobile sign-in: the app opens /auth/google?client=mobile&code_challenge=... in the system browser,
// gets bounced back to MOBILE_REDIRECT_URI with a one-time code, then trades code + verifier for a
// Bearer token at /auth/mobile/token. The verifier means a hijacked redirect alone is useless (PKCE, S256).
const MOBILE_REDIRECT_URI = process.env.MOBILE_REDIRECT_URI ?? "spampurge://auth";
const MOBILE_CODE_TTL_MS = 5 * 60 * 1000;
const mobileCodes = new Map<string, { userId: number; challenge: string; expiresAt: number }>();

function s256(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function sweepMobileCodes(): void {
  const now = Date.now();
  for (const [code, entry] of mobileCodes) if (entry.expiresAt < now) mobileCodes.delete(code);
}

function failRedirect(isMobile: boolean, error: string): string {
  return isMobile ? `${MOBILE_REDIRECT_URI}?error=${error}` : `/?error=${error}`;
}

router.get("/auth/status", (req, res) => {
  const user = req.user;
  if (user && user.refreshTokenEnc) {
    res.json({
      connected: true,
      email: user.email,
      name: user.name ?? null,
      picture: user.picture ?? null,
      riskAccepted: Boolean(user.riskAcceptedAt),
      appUserId: appUserId(user),
      premium: isEntitled(user),
      premiumUntil: user.premiumUntil ? user.premiumUntil.toISOString() : null,
    });
  } else {
    res.json({ connected: false, email: null, name: null, picture: null, riskAccepted: false, appUserId: null, premium: false, premiumUntil: null });
  }
});

router.get("/auth/google", (req, res) => {
  if (!getClientId() || !getClientSecret()) {
    res.status(503).send("Google OAuth is not configured. Please set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.");
    return;
  }
  const session = req.session as any;
  const isMobile = req.query.client === "mobile";
  const challenge = typeof req.query.code_challenge === "string" ? req.query.code_challenge : "";
  if (isMobile && !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
    res.status(400).send("Mobile sign-in requires an S256 code_challenge.");
    return;
  }

  const state = randomToken(16);
  session.oauthState = state;
  session.oauthClient = isMobile ? "mobile" : "web";
  session.codeChallenge = isMobile ? challenge : undefined;

  const oauth2Client = createOAuthClient({ withRedirect: true });
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    include_granted_scopes: true,
    state,
  });
  res.redirect(url);
});

router.get("/auth/google/callback", async (req, res) => {
  const { code, error, state } = req.query as { code?: string; error?: string; state?: string };
  const session = req.session as any;
  const isMobile = session.oauthClient === "mobile";
  const challenge: string | undefined = session.codeChallenge;

  if (error || !code) {
    req.log.warn({ error }, "OAuth callback error");
    res.redirect(failRedirect(isMobile, "oauth_denied"));
    return;
  }

  if (!state || !session.oauthState || state !== session.oauthState) {
    req.log.warn("OAuth state mismatch");
    res.redirect(failRedirect(isMobile, "oauth_state"));
    return;
  }
  delete session.oauthState;
  delete session.oauthClient;
  delete session.codeChallenge;

  try {
    const oauth2Client = createOAuthClient({ withRedirect: true });
    const { tokens } = await oauth2Client.getToken(code);

    // Google's consent screen lets people untick individual permissions. Without Gmail access there is nothing to do.
    if (!String(tokens.scope ?? "").split(" ").includes(GMAIL_SCOPE)) {
      req.log.warn("Gmail scope not granted");
      res.redirect(failRedirect(isMobile, "gmail_scope_missing"));
      return;
    }

    oauth2Client.setCredentials(tokens);
    const { data: userInfo } = await google.oauth2({ version: "v2", auth: oauth2Client }).userinfo.get();
    if (!userInfo.email) throw new Error("Google profile has no email");

    const user = await upsertUserFromOAuth(
      { email: userInfo.email, name: userInfo.name, picture: userInfo.picture },
      tokens.refresh_token,
    );
    if (!user.refreshTokenEnc) {
      res.redirect(failRedirect(isMobile, "no_refresh_token"));
      return;
    }

    req.log.info({ userId: user.id, client: isMobile ? "mobile" : "web" }, "User authenticated");

    if (isMobile && challenge) {
      sweepMobileCodes();
      const oneTimeCode = randomToken();
      mobileCodes.set(oneTimeCode, { userId: user.id, challenge, expiresAt: Date.now() + MOBILE_CODE_TTL_MS });
      res.redirect(`${MOBILE_REDIRECT_URI}?code=${oneTimeCode}`);
      return;
    }

    setTokenCookie(res, await issueApiToken(user.id, "web"));
    res.redirect("/dashboard");
  } catch (err) {
    req.log.error({ err }, "OAuth callback failed");
    res.redirect(failRedirect(isMobile, "oauth_failed"));
  }
});

// App Store / Google Play reviewer sign-in. The app requires a Google account to do anything, which a
// reviewer cannot sign in to, so this trades a shared review code for a Bearer token on a fixed demo
// account (entitled, risk pre-accepted, no real mailbox). No effect unless REVIEW_DEMO_CODE is set.
router.post("/auth/demo", async (req, res) => {
  const expected = process.env.REVIEW_DEMO_CODE;
  const { code } = (req.body ?? {}) as { code?: string };
  if (!expected || !code || code !== expected) {
    res.status(400).json({ error: "invalid_code" });
    return;
  }
  const user = await ensureDemoUser();
  const token = await issueApiToken(user.id, "mobile");
  setTokenCookie(res, token);
  req.log.info({ userId: user.id }, "Reviewer demo sign-in");
  res.json({ token });
});

router.post("/auth/mobile/token", async (req, res) => {
  const { code, code_verifier: verifier } = (req.body ?? {}) as { code?: string; code_verifier?: string };
  const entry = code ? mobileCodes.get(code) : undefined;
  if (code) mobileCodes.delete(code);
  if (!entry || entry.expiresAt < Date.now() || !verifier || s256(verifier) !== entry.challenge) {
    res.status(400).json({ error: "invalid_grant" });
    return;
  }
  res.json({ token: await issueApiToken(entry.userId, "mobile") });
});

// Signs out this browser or device only. Auto-purge keeps running.
router.post("/auth/logout", async (req, res) => {
  if (req.apiTokenId) await db.delete(apiTokensTable).where(eq(apiTokensTable.id, req.apiTokenId));
  clearTokenCookie(res);
  res.json({ success: true });
});

// Stops all purging, revokes Google access and signs out every device.
router.post("/auth/disconnect", async (req, res) => {
  try {
    if (req.user) await disconnectUser(req.user);
  } catch (err) {
    logger.error({ err }, "Failed to disconnect account");
  }
  clearTokenCookie(res);
  res.json({ success: true });
});

export default router;
