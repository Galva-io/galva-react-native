import { GalvaNative } from '../native/GalvaNative';

/**
 * The current opt-out state.
 *
 * @example
 * if (await isOptedOut()) showPrivacyBanner();
 */
export function isOptedOut(): Promise<boolean> {
  return GalvaNative.isOptedOut();
}
