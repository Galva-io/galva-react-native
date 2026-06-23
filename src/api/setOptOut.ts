import { GalvaNative } from '../native/GalvaNative';

/**
 * Globally disable / re-enable Galva's server-bound tracking. Persisted across
 * launches. In-app message delivery continues using the anonymous id.
 */
export function setOptOut(optedOut: boolean): void {
  GalvaNative.setOptOut(optedOut);
}
