import { GalvaNative } from '../native/GalvaNative';

/**
 * Force an off-cycle reconciliation of StoreKit transactions with Galva.
 * Rarely needed — the SDK sweeps on every foreground. Fire-and-forget.
 *
 * @example
 * reconcileTransactions();
 */
export function reconcileTransactions(): void {
  GalvaNative.reconcileTransactions();
}
