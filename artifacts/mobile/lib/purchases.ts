import { Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

// RevenueCat public SDK keys (safe to ship in the app), set per build in eas.json.
const KEY = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_RC_IOS_KEY : process.env.EXPO_PUBLIC_RC_ANDROID_KEY;

let configured = false;
let loggedInAs: string | null = null;

export function purchasesAvailable(): boolean {
  return Boolean(KEY);
}

// Configure once, then log in as the SPAM Purge account, so the server's webhook can tell whose
// subscription it is and a purchase follows the account to other devices.
export async function identify(appUserId: string): Promise<void> {
  if (!KEY) return;
  if (!configured) {
    Purchases.configure({ apiKey: KEY, appUserID: appUserId });
    configured = true;
    loggedInAs = appUserId;
    return;
  }
  if (loggedInAs !== appUserId) {
    await Purchases.logIn(appUserId);
    loggedInAs = appUserId;
  }
}

export async function forgetPurchaser(): Promise<void> {
  if (!configured || !loggedInAs) return;
  loggedInAs = null;
  try {
    await Purchases.logOut();
  } catch {
    // Already anonymous.
  }
}

export async function annualPackage(): Promise<PurchasesPackage | null> {
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  return current?.annual ?? current?.availablePackages[0] ?? null;
}

// "3-day free trial, then " when the store offers one.
export function trialText(p: PurchasesPackage): string {
  const t = p.product.introPrice;
  if (!t || t.price !== 0) return '';
  const n = t.periodNumberOfUnits * (t.cycles || 1);
  const unit = t.periodUnit.toLowerCase().replace(/s$/, '');
  return `${n}-${unit} free trial, then `;
}
