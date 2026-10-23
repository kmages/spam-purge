import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/lib/theme';

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const style = { padding: 16, paddingBottom: 16 + insets.bottom, gap: 16 };
  return scroll ? (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={style}>
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, backgroundColor: c.background }, style]}>{children}</View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return (
    <View style={[{ backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 }, style]}>
      {children}
    </View>
  );
}

type TextKind = 'title' | 'heading' | 'body' | 'muted' | 'small';

export function T({
  kind = 'body',
  children,
  style,
  numberOfLines,
}: {
  kind?: TextKind;
  children: React.ReactNode;
  style?: object;
  numberOfLines?: number;
}) {
  const c = useColors();
  const k = {
    title: { fontSize: 28, fontWeight: '800' as const, color: c.text },
    heading: { fontSize: 18, fontWeight: '700' as const, color: c.text },
    body: { fontSize: 16, lineHeight: 22, color: c.text },
    muted: { fontSize: 15, lineHeight: 21, color: c.muted },
    small: { fontSize: 13, color: c.muted },
  }[kind];
  return (
    <Text style={[k, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  busy,
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  busy?: boolean;
  disabled?: boolean;
}) {
  const c = useColors();
  const bg = kind === 'primary' ? c.primary : kind === 'danger' ? c.dangerSoft : c.card;
  const fg = kind === 'primary' ? c.primaryText : kind === 'danger' ? c.danger : c.text;
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: kind === 'secondary' ? c.border : bg, opacity: off ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontSize: 16, fontWeight: '700' }}>{label}</Text>}
    </Pressable>
  );
}

export function ToggleRow({
  label,
  detail,
  value,
  onChange,
  disabled,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <T>{label}</T>
        {detail ? <T kind="small">{detail}</T> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: c.primary }} accessibilityLabel={label} />
    </View>
  );
}

export function Chips<V extends string | number>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { label: string; value: V }[];
  value: V;
  onChange: (v: V) => void;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled }}
            disabled={disabled}
            onPress={() => onChange(o.value)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: on ? c.primary : c.border,
              backgroundColor: on ? c.primary : c.card,
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <Text style={{ color: on ? c.primaryText : c.text, fontWeight: '600' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function LinkRow({ label, detail, onPress }: { label: string; detail?: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <T>{label}</T>
        {detail ? <T kind="small">{detail}</T> : null}
      </View>
      <Text style={{ color: c.muted, fontSize: 22 }}>›</Text>
    </Pressable>
  );
}

export function Loading() {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
      <ActivityIndicator color={c.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 50, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
});
