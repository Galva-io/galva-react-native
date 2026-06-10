import { GalvaNative } from '../NativeBridge';

/**
 * Globally disable / re-enable Galva's server-bound tracking. When opted out,
 * tracking calls become silent no-ops and the persisted event queue is purged.
 * In-app message delivery continues to work using the anonymous id.
 *
 * The flag persists across app restarts. Read it back via {@link isOptedOut}.
 */
export function setOptOut(enabled: boolean): void {
  GalvaNative.setOptOut(enabled);
}
