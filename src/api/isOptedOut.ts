import { GalvaNative } from '../NativeBridge';

/** Current opt-out state — see {@link setOptOut}. */
export function isOptedOut(): Promise<boolean> {
  return GalvaNative.isOptedOut();
}
