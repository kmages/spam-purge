import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { getGetAllowlistQueryKey, useAddAllowlistEntry, useDeleteAllowlistEntry, useGetAllowlist } from '@workspace/api-client-react';
import { Button, Card, Screen, T } from '@/components/ui';
import { useColors } from '@/lib/theme';

export default function Allowlist() {
  const c = useColors();
  const qc = useQueryClient();
  const [pattern, setPattern] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { data: entries } = useGetAllowlist();
  const refresh = () => qc.invalidateQueries({ queryKey: getGetAllowlistQueryKey() });

  const add = useAddAllowlistEntry({
    mutation: {
      onSuccess: () => {
        setPattern('');
        setError(null);
        void refresh();
      },
      onError: async (err: unknown) => {
        const data = (err as { data?: { message?: string } }).data;
        setError(data?.message ?? 'Could not add that. Please try again.');
      },
    },
  });
  const remove = useDeleteAllowlistEntry({ mutation: { onSuccess: () => void refresh() } });

  return (
    <Screen>
      <T kind="muted">
        Spam from these senders stays in your Spam folder so you can rescue it. Use a full address, or a domain like
        mybank.com to cover everyone there.
      </T>
      <Card>
        <TextInput
          value={pattern}
          onChangeText={setPattern}
          placeholder="name@example.com or example.com"
          placeholderTextColor={c.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          returnKeyType="done"
          onSubmitEditing={() => pattern.trim() && add.mutate({ data: { pattern } })}
          accessibilityLabel="Sender or domain to allowlist"
          style={{ borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 12, fontSize: 16, color: c.text }}
        />
        {error ? <T style={{ color: c.danger }}>{error}</T> : null}
        <Button label="Add" onPress={() => add.mutate({ data: { pattern } })} busy={add.isPending} disabled={!pattern.trim()} />
      </Card>
      {entries && entries.length > 0 ? (
        <Card>
          {entries.map((e) => (
            <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 12 }}>
              <T style={{ flex: 1 }}>{e.pattern}</T>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${e.pattern}`}
                onPress={() => remove.mutate({ id: e.id })}
                hitSlop={8}
              >
                <T style={{ color: c.danger, fontWeight: '600' }}>Remove</T>
              </Pressable>
            </View>
          ))}
        </Card>
      ) : (
        <T kind="small">Nothing on your allowlist yet.</T>
      )}
    </Screen>
  );
}
