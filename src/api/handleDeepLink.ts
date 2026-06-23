import { GalvaNative } from '../native/GalvaNative';

/**
 * Manually forward a URL to Galva. Usually unnecessary — `configureSDK` already
 * forwards links via React Native's `Linking` API. Resolves `true` if Galva
 * claimed the link (a `gv…` deep link), `false` otherwise.
 */
export function handleDeepLink(url: string): Promise<boolean> {
  return GalvaNative.handleDeepLink(url);
}
