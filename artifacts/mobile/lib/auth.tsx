import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { exchangeMobileCode, logout, setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';

const TOKEN_KEY = 'spampurge.token';
const REDIRECT_URI = 'spampurge://auth';

export const API_ORIGIN = `https://${process.env.EXPO_PUBLIC_DOMAIN ?? 'spampurge.5-161-180-197.nip.io'}`;
setBaseUrl(API_ORIGIN);

// The API client reads the token through this module-level slot so every request picks up sign-in and sign-out at once.
let currentToken: string | null = null;
setAuthTokenGetter(() => currentToken);

const SIGN_IN_ERRORS: Record<string, string> = {
  oauth_denied: 'Google sign-in was cancelled.',
  gmail_scope_missing: 'SPAM Purge needs permission to manage your Gmail. Sign in again and leave the Gmail box ticked.',
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
    currentToken = null;
    setSignedIn(false);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }, []);

  // PKCE (S256): only the verifier's hash travels through the browser, so an app that grabs the redirect can't use the code.
  const signIn = useCallback(async (): Promise<string | null> => {
    const verifier = base64url(Crypto.getRandomBytes(32));
    const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
      encoding: Crypto.CryptoEncoding.BASE64,
    });
    const challenge = digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const result = await WebBrowser.openAuthSessionAsync(
      `${API_ORIGIN}/api/auth/google?client=mobile&code_challenge=${challenge}`,
      REDIRECT_URI,
    );
    if (result.type !== 'success') return null;

    const { queryParams } = Linking.parse(result.url);
    const error = typeof queryParams?.error === 'string' ? queryParams.error : null;
    const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
    if (error) return error === 'oauth_denied' ? null : (SIGN_IN_ERRORS[error] ?? SIGN_IN_ERRORS.oauth_failed);
    if (!code) return SIGN_IN_ERRORS.oauth_failed;

    try {
      const { token } = await exchangeMobileCode({ code, code_verifier: verifier });
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      currentToken = token;
      setSignedIn(true);
      return null;
    } catch {
      return SIGN_IN_ERRORS.oauth_failed;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } catch {
      // Signing out locally still works when the server is unreachable.
    }
    await forget();
  }, [forget]);

  return <AuthContext.Provider value={{ ready, signedIn, signIn, signOut, forget }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
