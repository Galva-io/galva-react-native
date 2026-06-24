import { GalvaNative } from '../native/GalvaNative';

/**
 * Globally disable / re-enable Galva's server-bound tracking. Persisted across
 * launches. In-app message delivery continues using the anonymous id.
 *
 * @example
 * setOptOut(true); // honor a "do not track" preference
 */
export function setOptOut(optedOut: boolean): void {
  GalvaNative.setOptOut(optedOut);
}
