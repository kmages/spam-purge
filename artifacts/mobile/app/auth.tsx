import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Loading, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';

// Landing page for spampurge://auth?code=... On Android the redirect from Google opens this route.
export default function AuthRedirect() {
  const { completeRedirect } = useAuth();
  const params = useLocalSearchParams<{ code?: string; error?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    completeRedirect(params.code ?? null, params.error ?? null).then((message) => {
      if (!active) return;
      if (message) setError(message);
      else router.replace('/');
    });
    return () => {
      active = false;
    };
  }, [completeRedirect, params.code, params.error]);

  if (!error) return <Loading />;
  return (
    <Screen>
      <T kind="heading">Sign-in didn't finish</T>
      <T>{error}</T>
      <Button label="Back" onPress={() => router.replace('/')} />
    </Screen>
  );
}
