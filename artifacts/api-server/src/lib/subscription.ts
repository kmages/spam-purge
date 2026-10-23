// What a RevenueCat webhook event means for one user's subscription. Pure, so it can be tested
// without a database. The route in routes/revenuecat.ts applies the result.

export const ENTITLEMENT = "premium"; // matches the app and the RevenueCat project

// Events that start or extend paid access; their expiration_at_ms is the new end of access.
const GRANT = new Set(["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION", "SUBSCRIPTION_EXTENDED"]);

export interface RevenueCatEvent {
  type?: string;
  app_user_id?: string;
  entitlement_ids?: string[] | null;
  entitlement_id?: string | null;
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number;
  cancel_reason?: string;
  transferred_from?: string[];
  transferred_to?: string[];
}

export interface CurrentState {
  premiumEventAt: Date | null;
}

export type Decision =
  | { action: "ignore"; reason: string }
  | { action: "set"; premiumUntil: Date; premiumEventAt: Date };

export function decide(event: RevenueCatEvent, current: CurrentState, now = new Date()): Decision {
  const ids = event.entitlement_ids ?? (event.entitlement_id ? [event.entitlement_id] : null);
  if (Array.isArray(ids) && !ids.includes(ENTITLEMENT)) return { action: "ignore", reason: "other entitlement" };

  const eventAt = new Date(event.event_timestamp_ms ?? now.getTime());
  if (current.premiumEventAt && eventAt < current.premiumEventAt) return { action: "ignore", reason: "older than the last event applied" };

  const type = event.type ?? "";
  if (GRANT.has(type)) {
    if (!event.expiration_at_ms) return { action: "ignore", reason: "grant without an expiry" };
    return { action: "set", premiumUntil: new Date(event.expiration_at_ms), premiumEventAt: eventAt };
  }
  if (type === "EXPIRATION") {
    return { action: "set", premiumUntil: new Date(Math.min(event.expiration_at_ms ?? now.getTime(), now.getTime())), premiumEventAt: eventAt };
  }
  // A refund ends access now. An ordinary cancellation only turns off renewal: access lasts until EXPIRATION.
  if (type === "CANCELLATION" && event.cancel_reason === "CUSTOMER_SUPPORT") {
    return { action: "set", premiumUntil: now, premiumEventAt: eventAt };
  }
  return { action: "ignore", reason: `no change for ${type || "unknown event"}` };
}
