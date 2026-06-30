import { GalvaNative } from '../native/GalvaNative';

/**
 * The StoreKit 2 `appAccountToken` (a lowercased UUID string) Galva attaches to
 * purchases for the current identity — the token you passed to `identifyUser`
 * when set, otherwise Galva's generated one. It's the same value the SDK uses
 * for its own purchases, so passing it into a purchase you start yourself (e.g.
 * with `react-native-iap` / `expo-iap`'s `appAccountToken` option) reconciles
 * that purchase to the same Galva account.
 *
 * Resolves to `null` only before `configureSDK` has run.
 *
 * @example
 * const token = await getAppAccountToken();
 * // pass `token` as the appAccountToken when starting your own purchase
 */
export function getAppAccountToken(): Promise<string | null> {
  return GalvaNative.getAppAccountToken();
}
