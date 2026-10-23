import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAuthStatusQueryKey,
  getGetPurgeHistoryQueryKey,
  getGetPurgeLogQueryKey,
  getGetSettingsQueryKey,
  getGetSpamCountQueryKey,
  useAcceptRisk,
  useGetAuthStatus,
  useGetSettings,
  useGetSpamCount,
  usePurgeSpam,
  useUpdateSettings,
} from '@workspace/api-client-react';
import { Button, Card, Chips, LinkRow, Loading, Screen, T, ToggleRow } from '@/components/ui';
import { GoogleWarningIllustration } from '@/components/GoogleWarningIllustration';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/lib/theme';

const INTERVALS = [
  { label: '5 min', value: 5 },
  { label: '15 min', value: 15 },
  { label: '1 hour', value: 60 },
  { label: '6 hours', value: 360 },
  { label: 'Daily', value: 1440 },
];

export default function Index() {
  const { ready, signedIn } = useAuth();
  if (!ready) return <Loading />;
  return signedIn ? <SignedIn /> : <SignIn />;
}

function SignIn() {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignIn = async () => {
    setBusy(true);
    setError(null);
    setError(await signIn());
    setBusy(false);
  };

  return (
    <Screen>
      <View style={{ gap: 8, marginTop: 24 }}>
        <T kind="title">Hate seeing spam?</T>
        <T kind="muted">
          Gmail keeps spam and trash for 30 days. SPAM Purge deletes them permanently as they arrive, around the clock,
          even when your phone is off.
        </T>
      </View>
      <Card>
        <T kind="heading">Before you connect</T>
        <T>Gmail's filter sometimes gets it wrong. If something you need lands in Spam, SPAM Purge deletes it, and it is gone forever. There is no undo.</T>
      </Card>
      <Card>
        <T kind="heading">Google will show a warning. Here's why.</T>
        <T>
          Google shows "Google hasn't verified this app" for small independent apps that haven't paid for its yearly
          security audit. SPAM Purge is one person's app, not a big company. To continue, tap Advanced, then Go to
          spam-purge.com (unsafe).
        </T>
        <T>
          On the permissions screen that follows, tick the Gmail box ("Read, compose, send and permanently delete all your
          email") or Select all, then Continue. Google may leave it unticked, and SPAM Purge can't delete anything without
          it.
        </T>
        <GoogleWarningIllustration />
        <T kind="muted">
          What SPAM Purge does with your Gmail: counts Spam and Trash, reads the sender and subject of spam, and deletes.
          It never reads message bodies, never reads your Inbox, and never sends anything.
        </T>
      </Card>
      {error ? <T style={{ color: '#B3261E' }}>{error}</T> : null}
      <Button label="Connect Gmail" onPress={onSignIn} busy={busy} />
      <T kind="small">Google asks for full Gmail access because permanent deletion requires it.</T>
    </Screen>
  );
}

function SignedIn() {
  const { forget } = useAuth();
  const { data: auth, isLoading } = useGetAuthStatus();

  // Google access was revoked or the account was disconnected elsewhere.
  useEffect(() => {
    if (auth && !auth.connected) void forget();
  }, [auth, forget]);

  if (isLoading || !auth?.connected) return <Loading />;
  return auth.riskAccepted ? <Dashboard /> : <RiskGate />;
}

function RiskGate() {
  const qc = useQueryClient();
  const accept = useAcceptRisk({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getGetAuthStatusQueryKey() }) },
  });
  const c = useColors();
  return (
    <Screen>
      <Card style={{ borderColor: c.danger }}>
        <T kind="heading">Read this before you purge</T>
        <T>SPAM Purge permanently deletes everything in your Gmail Spam and Trash. There is no undo.</T>
        <T>Gmail's filter sometimes gets it wrong. If something you need lands in Spam, it will be gone forever.</T>
        <T kind="muted">You can soften this later with a delay or an allowlist of senders you never want lost.</T>
      </Card>
      <Button label="I understand. Deleted means gone forever." kind="danger" onPress={() => accept.mutate()} busy={accept.isPending} />
    </Screen>
  );
}

function Dashboard() {
  const qc = useQueryClient();
  const { data: count, isLoading: counting, refetch } = useGetSpamCount();
  const { data: settings } = useGetSettings();

  const refreshAll = () => {
    for (const key of [getGetSpamCountQueryKey(), getGetPurgeHistoryQueryKey(), getGetPurgeLogQueryKey()]) {
      void qc.invalidateQueries({ queryKey: key });
    }
  };

  const purge = usePurgeSpam({
    mutation: {
      onSuccess: (r) => {
        refreshAll();
        const kept = r.spamKept ? ` ${r.spamKept} left in Spam by your allowlist or delay.` : '';
        Alert.alert('Purged', `${r.message ?? `Deleted ${r.deleted}.`}${kept}`);
      },
      onError: () => Alert.alert('Purge failed', 'Please try again.'),
    },
  });

  const update = useUpdateSettings({
    mutation: {
      onSuccess: (s) => qc.setQueryData(getGetSettingsQueryKey(), s),
      onError: () => Alert.alert('Could not save', 'Please try again.'),
    },
  });

  const confirmPurge = () => {
    if (!count?.count) return;
    Alert.alert('Delete permanently?', `${count.count} message${count.count === 1 ? '' : 's'} will be gone forever.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => purge.mutate() },
    ]);
  };

  const lastRun = settings?.lastRunAt ? new Date(settings.lastRunAt).toLocaleString() : 'not yet';

  return (
    <Screen>
      <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
        {counting ? (
          <T kind="muted">Checking Gmail...</T>
        ) : (
          <>
            <T kind="title" style={{ fontSize: 56 }}>{String(count?.count ?? 0)}</T>
            <T kind="muted">
              {`${count?.spam ?? 0} in Spam${settings && !settings.purgeSpam ? ' (skipped)' : ''}, ${count?.trash ?? 0} in Trash${settings && !settings.purgeTrash ? ' (skipped)' : ''}`}
            </T>
          </>
        )}
        <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 8 }}>
          <Button label="Purge now" onPress={confirmPurge} busy={purge.isPending} disabled={!count?.count} />
          <Button label="Refresh" kind="secondary" onPress={() => void refetch()} />
        </View>
      </Card>

      <Card>
        <ToggleRow
          label="Automatic purge"
          detail={`Runs on our server, even when your phone is off. Last run: ${lastRun}.`}
          value={settings?.autoPurgeEnabled ?? false}
          disabled={!settings || update.isPending}
          onChange={(v) => update.mutate({ data: { autoPurgeEnabled: v } })}
        />
        {settings?.autoPurgeEnabled ? (
          <Chips
            options={INTERVALS}
            value={settings.autoPurgeIntervalMinutes}
            disabled={update.isPending}
            onChange={(v) => update.mutate({ data: { autoPurgeIntervalMinutes: v } })}
          />
        ) : null}
      </Card>

      <Card>
        <LinkRow label="What to purge" detail="Spam, Trash, and an optional delay" onPress={() => router.push('/settings')} />
        <LinkRow label="Allowlist" detail="Senders whose spam is never deleted" onPress={() => router.push('/allowlist')} />
        <LinkRow label="What got purged" detail="Sender and subject, last 30 days" onPress={() => router.push('/log')} />
        <LinkRow label="Account" onPress={() => router.push('/account')} />
      </Card>
    </Screen>
  );
}
