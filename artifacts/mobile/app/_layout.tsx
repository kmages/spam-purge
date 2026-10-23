import React, { useMemo } from 'react';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useColors } from '@/lib/theme';

// Expo Router renders this instead of closing the app when a screen throws, so a failure is visible and reportable.
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.background, padding: 24, paddingTop: 80, gap: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>Something went wrong</Text>
      <Text style={{ fontSize: 15, color: c.muted }}>Please screenshot this and send it to kmages@gmail.com.</Text>
      <Text selectable style={{ fontSize: 13, color: c.text, fontFamily: 'Menlo' }}>
        {error.message}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void retry()}
        style={{ backgroundColor: c.primary, borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: c.primaryText, fontWeight: '700', fontSize: 16 }}>Try again</Text>
      </Pressable>
    </View>
  );
}

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
            <Stack.Screen name="auth" options={{ title: 'Signing in', headerShown: false }} />
          </Stack>
        </QueryRoot>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
