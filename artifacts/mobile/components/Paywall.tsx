import React, { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { getAuthStatus, getGetAuthStatusQueryKey } from '@workspace/api-client-react';
import { Button, Card, Screen, T } from '@/components/ui';
import { API_ORIGIN } from '@/lib/auth';
import { annualPackage, purchasesAvailable, trialText } from '@/lib/purchases';
import { useColors } from '@/lib/theme';

const APPLE_TERMS = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
// The store confirms a purchase to RevenueCat, which tells our server. Wait this long for that.
const ACTIVATION_WAIT_MS = 45_000;

export function Paywall() {
  const c = useColors();
  const qc = useQueryClient();
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'buy' | 'restore' | 'activating' | null>(null);

  useEffect(() => {
    if (!purchasesAvailable()) {
      setLoadError('Subscriptions are not available in this build.');
      return;
    }
    annualPackage()
      .then((p) => (p ? setPkg(p) : setLoadError('The subscription could not be loaded. Please try again later.')))
      .catch(() => setLoadError('The subscription could not be loaded. Check your connection and try again.'));
  }, []);

  // The server unlocks purging when the store's confirmation reaches it, usually within seconds.
  const waitForServer = async (): Promise<boolean> => {
    setBusy('activating');
    const end = Date.now() + ACTIVATION_WAIT_MS;
    while (Date.now() < end) {
      const status = await getAuthStatus().catch(() => null);
      if (status?.premium) {
        qc.setQueryData(getGetAuthStatusQueryKey(), status);
        return true;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return false;
  };

  const finish = async (unlocked: boolean) => {
    const ok = unlocked && (await waitForServer());
    setBusy(null);
    if (unlocked && !ok) {
      Alert.alert('Almost there', 'Your subscription went through. It can take a minute to activate. Pull to refresh, or reopen the app shortly.');
    }
  };

  const buy = async () => {
    if (!pkg) return;
    setBusy('buy');
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      await finish(Boolean(customerInfo.entitlements.active.premium));
    } catch (err) {
      setBusy(null);
      if (!(err as { userCancelled?: boolean }).userCancelled) Alert.alert('Purchase failed', 'Nothing was charged. Please try again.');
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const info = await Purchases.restorePurchases();
      const active = Boolean(info.entitlements.active.premium);
      if (!active) {
        setBusy(null);
        Alert.alert('Nothing to restore', 'No active SPAM Purge subscription was found for this account.');
        return;
      }
      await finish(true);
    } catch {
      setBusy(null);
      Alert.alert('Restore failed', 'Please try again.');
    }
  };

  const store = Platform.OS === 'ios' ? 'Apple ID' : 'Google Play account';
  const manage = Platform.OS === 'ios' ? 'Settings > Apple ID > Subscriptions' : 'Google Play > Payments & subscriptions';

  return (
    <Screen>
      <View style={{ gap: 8, marginTop: 8 }}>
        <T kind="title">Turn on SPAM Purge</T>
        <T kind="muted">Spam and Trash deleted for good, around the clock, on your schedule. Your allowlist and delay keep working.</T>
      </View>
      <Card>
        {pkg ? (
          <>
            <T kind="heading">{`${trialText(pkg)}${pkg.product.priceString} a year`}</T>
            <T kind="muted">Cancel anytime. If you cancel during the free trial, you won't be charged.</T>
          </>
        ) : (
          <T kind="muted">{loadError ?? 'Loading...'}</T>
        )}
        <Button
          label={busy === 'activating' ? 'Activating...' : pkg && trialText(pkg) ? 'Start free trial' : 'Subscribe'}
          onPress={buy}
          busy={busy === 'buy' || busy === 'activating'}
          disabled={!pkg || busy !== null}
        />
        <Button label="Restore purchases" kind="secondary" onPress={restore} busy={busy === 'restore'} disabled={busy !== null} />
      </Card>
      <T kind="small">
        {`Payment is charged to your ${store} when you confirm, after any free trial. The subscription renews automatically each year unless you cancel at least 24 hours before the end of the current period. Manage or cancel it in ${manage}.`}
      </T>
      <View style={{ flexDirection: 'row', gap: 20 }}>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(APPLE_TERMS)} hitSlop={8}>
          <T kind="small" style={{ color: c.primary }}>Terms of Use</T>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`${API_ORIGIN}/privacy`)} hitSlop={8}>
          <T kind="small" style={{ color: c.primary }}>Privacy Policy</T>
        </Pressable>
      </View>
    </Screen>
  );
}
