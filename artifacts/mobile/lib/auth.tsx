import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { exchangeMobileCode, logout, setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import { forgetPurchaser } from './purchases';

const TOKEN_KEY = 'spampurge.token';
const REDIRECT_URI = 'spampurge://auth';

export const API_ORIGIN = `https://${process.env.EXPO_PUBLIC_DOMAIN ?? 'spam-purge.com'}`;
setBaseUrl(API_ORIGIN);

// The API client reads the token through this module-level slot so every request picks up sign-in and sign-out at once.
let currentToken: string | null = null;
setAuthTokenGetter(() => currentToken);

// Sign-in in progress: the PKCE verifier, and each one-time code's redemption so it happens once.
let pendingVerifier: string | null = null;
const redemptions = new Map<string, Promise<string | null>>();

const SIGN_IN_ERRORS: Record<string, string> = {
  oauth_denied: 'Google sign-in was cancelled.',
  gmail_scope_missing: 'The Gmail box was not ticked on Google\'s permissions screen. Connect again, and tick "Read, compose, send and permanently delete all your email" (or Select all) before tapping Continue.',
  no_refresh_token: 'Google did not grant ongoing access. Sign in again.',
  oauth_state: 'Sign-in expired. Please try again.',
  oauth_failed: 'Sign-in failed. Please try again.',
};

function base64url(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += chars[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += chars[n & 63];
  }
  return out;
}

interface AuthContextValue {
  ready: boolean;
  signedIn: boolean;
  // Resolves to an error message, or null on success or a silent cancel.
  signIn: () => Promise<string | null>;
  // Finishes sign-in from the redirect's code or error. Resolves to an error message, or null.
  completeRedirect: (code: string | null, error: string | null) => Promise<string | null>;
  signOut: () => Promise<void>;
  // Drops the local token without calling the server, e.g. after the account is deleted or a 401.
  forget: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(TOKEN_KEY)
      .then((t) => {
        currentToken = t;
        setSignedIn(Boolean(t));
      })
      .finally(() => setReady(true));
  }, []);

  const forget = useCallback(async () => {
    void forgetPurchaser();
    currentToken = null;
    setSignedIn(false);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }, []);

  // The redirect back from Google reaches the app two ways: iOS returns it from openAuthSessionAsync,
  // while Android also opens it as a deep link to the /auth route. Both call this, and the one-time
  // code is redeemed only once.
  const completeRedirect = useCallback(
    (code: string | null, error: string | null): Promise<string | null> => {
      if (error) return Promise.resolve(error === 'oauth_denied' ? null : (SIGN_IN_ERRORS[error] ?? SIGN_IN_ERRORS.oauth_failed));
      if (!code) return Promise.resolve(SIGN_IN_ERRORS.oauth_failed);
      const existing = redemptions.get(code);
      if (existing) return existing;
      const verifier = pendingVerifier;
      if (!verifier) return Promise.resolve(null); // a stale link with no sign-in in progress
      const redemption = (async () => {
        try {
          const { token } = await exchangeMobileCode({ code, code_verifier: verifier });
          await SecureStore.setItemAsync(TOKEN_KEY, token);
          currentToken = token;
          pendingVerifier = null;
          setSignedIn(true);
          return null;
        } catch {
          return SIGN_IN_ERRORS.oauth_failed;
        }
      })();
      redemptions.set(code, redemption);
      return redemption;
    },
    [],
  );

  // PKCE (S256): only the verifier's hash travels through the browser, so an app that grabs the redirect can't use the code.
  const signIn = useCallback(async (): Promise<string | null> => {
    const verifier = base64url(Crypto.getRandomBytes(32));
    const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
      encoding: Crypto.CryptoEncoding.BASE64,
    });
    const challenge = digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    pendingVerifier = verifier;

    const result = await WebBrowser.openAuthSessionAsync(
      `${API_ORIGIN}/api/auth/google?client=mobile&code_challenge=${challenge}`,
      REDIRECT_URI,
    );
    // On Android the browser can report "dismiss" because the /auth route already took the redirect.
    if (result.type !== 'success') return null;

    const { queryParams } = Linking.parse(result.url);
    return completeRedirect(
      typeof queryParams?.code === 'string' ? queryParams.code : null,
      typeof queryParams?.error === 'string' ? queryParams.error : null,
    );
  }, [completeRedirect]);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } catch {
      // Signing out locally still works when the server is unreachable.
    }
    await forget();
  }, [forget]);

  return <AuthContext.Provider value={{ ready, signedIn, signIn, completeRedirect, signOut, forget }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
