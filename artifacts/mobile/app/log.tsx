import React from 'react';
import { View } from 'react-native';
import { useGetPurgeHistory, useGetPurgeLog } from '@workspace/api-client-react';
import { Card, Loading, Screen, T } from '@/components/ui';

export default function Log() {
  const { data: log, isLoading } = useGetPurgeLog();
  const { data: history } = useGetPurgeHistory();
  if (isLoading) return <Loading />;

  const total = (history ?? []).reduce((n, r) => n + r.deletedCount, 0);

  return (
    <Screen>
      {history && history.length > 0 ? (
        <T kind="muted">{`${total.toLocaleString()} deleted across the last ${history.length} runs.`}</T>
      ) : null}
      <T kind="small">Spam only, sender and subject. Trash is mail you deleted yourself, so it is not listed.</T>
      {log && log.length > 0 ? (
        <Card>
          {log.map((m) => (
            <View key={m.id} style={{ gap: 2, paddingVertical: 4 }}>
              <T numberOfLines={1}>{m.subject || '(no subject)'}</T>
              <T kind="small">{`${m.sender ?? 'Unknown sender'} · ${new Date(m.purgedAt).toLocaleString()}`}</T>
            </View>
          ))}
        </Card>
      ) : (
        <T kind="muted">No spam purged in the last 30 days.</T>
      )}
    </Screen>
  );
}
