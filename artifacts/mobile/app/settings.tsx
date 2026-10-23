import React from 'react';
import { Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { getGetSettingsQueryKey, getGetSpamCountQueryKey, useGetSettings, useUpdateSettings, type UpdateSettings } from '@workspace/api-client-react';
import { Card, Chips, Loading, Screen, T, ToggleRow } from '@/components/ui';

const DELAYS = [
  { label: 'Off', value: 0 },
  { label: '1 hour', value: 60 },
  { label: '24 hours', value: 1440 },
];

export default function Settings() {
  const qc = useQueryClient();
  const { data: s } = useGetSettings();
  const update = useUpdateSettings({
    mutation: {
      onSuccess: (next) => {
        qc.setQueryData(getGetSettingsQueryKey(), next);
        void qc.invalidateQueries({ queryKey: getGetSpamCountQueryKey() });
      },
      onError: () => Alert.alert('Could not save', 'Please try again.'),
    },
  });
  if (!s) return <Loading />;
  const save = (data: UpdateSettings) => update.mutate({ data });

  return (
    <Screen>
      <Card>
        <ToggleRow label="Purge Spam" value={s.purgeSpam} disabled={update.isPending} onChange={(v) => save({ purgeSpam: v })} />
        <ToggleRow
          label="Purge Trash"
          detail="Mail you already deleted, skipping Gmail's 30-day wait"
          value={s.purgeTrash}
          disabled={update.isPending}
          onChange={(v) => save({ purgeTrash: v })}
        />
      </Card>
      <Card>
        <T kind="heading">Delay before deleting spam</T>
        <T kind="muted">
          Leaves new spam alone for a while so you can glance at it first. Off means it is deleted on the next run.
        </T>
        <Chips options={DELAYS} value={s.spamDelayMinutes} disabled={update.isPending} onChange={(v) => save({ spamDelayMinutes: v })} />
      </Card>
    </Screen>
  );
}
