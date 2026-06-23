import { GalvaNative } from '../native/GalvaNative';

/**
 * Identify the current user. Pass `appAccountToken` (a UUID string) to link
 * StoreKit purchases to this user. Fire-and-forget.
 */
export function identifyUser(
  userId: string,
  options?: { appAccountToken?: string }
): void {
  GalvaNative.identifyUser(userId, options?.appAccountToken ?? null);
}
