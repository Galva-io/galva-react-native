import { GalvaNative } from '../native/GalvaNative';

/** The current opt-out state. */
export function isOptedOut(): Promise<boolean> {
  return GalvaNative.isOptedOut();
}
