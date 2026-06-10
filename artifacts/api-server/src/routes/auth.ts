import { Router } from "express";
import crypto from "crypto";
import { google } from "googleapis";
import { logger } from "../lib/logger";
import { createOAuthClient, getClientId, getClientSecret } from "../lib/google";
import { persistRefreshToken, clearStoredAccount } from "../lib/account";

const router = Router();

const SCOPES = ["https://mail.google.com/", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"];

router.get("/auth/status", (req, res) => {
  const session = req.session as any;
  if (session.tokens && session.userInfo) {
    res.json({
      connected: true,
      email: session.userInfo.email ?? null,
      name: session.userInfo.name ?? null,
      picture: session.userInfo.picture ?? null,
    });
  } else {
    res.json({ connected: false, email: null, name: null, picture: null });
  }
});

router.get("/auth/google", (req, res) => {
  if (!getClientId() || !getClientSecret()) {
    res.status(503).send("Google OAuth is not configured. Please set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.");
    return;
  }
  const state = crypto.randomBytes(16).toString("hex");
  (req.session as any).oauthState = state;
  const oauth2Client = createOAuthClient({ withRedirect: true });
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state,
  });
  res.redirect(url);
});

router.get("/auth/google/callback", async (req, res) => {
  const { code, error, state } = req.query as { code?: string; error?: string; state?: string };
  const session = req.session as any;

  if (error || !code) {
    req.log.warn({ error }, "OAuth callback error");
    res.redirect("/?error=oauth_denied");
    return;
  }

  if (!state || !session.oauthState || state !== session.oauthState) {
    req.log.warn("OAuth state mismatch");
    res.redirect("/?error=oauth_state");
    return;
  }
  delete session.oauthState;

  try {
    const oauth2Client = createOAuthClient({ withRedirect: true });
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    session.tokens = tokens;
    session.userInfo = {
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
    };

    await persistRefreshToken(tokens.refresh_token, session.userInfo);

    req.log.info({ email: userInfo.email }, "User authenticated");
    res.redirect("/dashboard");
  } catch (err) {
    req.log.error({ err }, "OAuth callback failed");
    res.redirect("/?error=oauth_failed");
  }
});

router.post("/auth/disconnect", async (req, res) => {
  try {
    await clearStoredAccount();
  } catch (err) {
    logger.error({ err }, "Failed to clear stored account");
  }
  req.session.destroy((err) => {
    if (err) {
      logger.error({ err }, "Session destroy error");
    }
    res.json({ success: true });
  });
});

export default router;
