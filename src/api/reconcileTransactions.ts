import { GalvaNative } from '../NativeBridge';

/**
 * Force an off-cycle reconciliation of the device's StoreKit transaction
 * history with Galva's backend. Normally driven automatically on every app
 * foreground — call this only to short-circuit that cadence (e.g. right after
 * your billing observer acknowledges a purchase, or from a "Restore
 * Purchases" flow).
 *
 * Fire-and-forget and idempotent. iOS-backed; no-op on Android until the
 * Android core ships an equivalent.
 */
export function reconcileTransactions(): void {
  GalvaNative.reconcileTransactions();
}
