import { GalvaNative } from '../NativeBridge';

/**
 * Manually trigger a poll for pending in-app messages. Normally driven by the
 * foreground lifecycle — use this to refresh outside that cadence (e.g. after
 * an in-app action that should retrigger a workflow attempt).
 */
export function checkForMessages(): void {
  GalvaNative.checkForMessages();
}
