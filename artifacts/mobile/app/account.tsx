import React, { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { deleteAccount, disconnectAuth, useGetAuthStatus } from '@workspace/api-client-react';
import { Button, Card, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function Account() {
  const { signOut, forget } = useAuth();
  const { data: auth } = useGetAuthStatus();
  const [busy, setBusy] = useState<'out' | 'disconnect' | 'delete' | null>(null);

  const run = async (kind: 'out' | 'disconnect' | 'delete') => {
    setBusy(kind);
    try {
      if (kind === 'out') await signOut();
      else {
        await (kind === 'delete' ? deleteAccount() : disconnectAuth());
        await forget();
      }
      router.replace('/');
    } catch {
      Alert.alert('Something went wrong', 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Card>
        <T kind="heading">{auth?.email ?? ''}</T>
        <T kind="muted">Signing out of this phone leaves automatic purging running.</T>
        <Button label="Sign out" kind="secondary" busy={busy === 'out'} onPress={() => run('out')} />
      </Card>
      <Card>
        <T kind="heading">Stop purging</T>
        <T kind="muted">Turns off automatic purging, removes SPAM Purge's access to your Gmail, and signs out every device.</T>
        <Button
          label="Disconnect Gmail"
          kind="secondary"
          busy={busy === 'disconnect'}
          onPress={() =>
            Alert.alert('Disconnect Gmail?', 'Automatic purging stops on every device.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Disconnect', style: 'destructive', onPress: () => run('disconnect') },
            ])
          }
        />
      </Card>
      <Card>
        <T kind="heading">Delete account</T>
        <T kind="muted">Removes your account, settings, allowlist and history from our server, and revokes Gmail access.</T>
        <Button
          label="Delete account"
          kind="danger"
          busy={busy === 'delete'}
          onPress={() =>
            Alert.alert('Delete your account?', 'This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => run('delete') },
            ])
          }
        />
      </Card>
    </Screen>
  );
}
