import React, { useMemo } from 'react';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useColors } from '@/lib/theme';

function isUnauthorized(err: unknown): boolean {
  return (err as { status?: number } | null)?.status === 401;
}

function QueryRoot({ children }: { children: React.ReactNode }) {
  const { signedIn, forget } = useAuth();
  // A fresh cache per sign-in so one account's data never shows under another.
  const client = useMemo(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: (err) => isUnauthorized(err) && void forget() }),
        mutationCache: new MutationCache({ onError: (err) => isUnauthorized(err) && void forget() }),
        defaultOptions: { queries: { retry: (n, err) => !isUnauthorized(err) && n < 2 } },
      }),
    [signedIn, forget],
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export default function RootLayout() {
  const c = useColors();
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <QueryRoot>
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: c.background },
              headerShadowVisible: false,
              headerTintColor: c.text,
              headerBackTitle: 'Back',
              contentStyle: { backgroundColor: c.background },
            }}
          >
            <Stack.Screen name="index" options={{ title: 'SPAM Purge' }} />
            <Stack.Screen name="settings" options={{ title: 'What to purge' }} />
            <Stack.Screen name="allowlist" options={{ title: 'Allowlist' }} />
            <Stack.Screen name="log" options={{ title: 'What got purged' }} />
            <Stack.Screen name="account" options={{ title: 'Account' }} />
          </Stack>
        </QueryRoot>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
