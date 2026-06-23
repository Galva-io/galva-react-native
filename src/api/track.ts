import { GalvaNative } from '../native/GalvaNative';
import type { GalvaAttributes } from '../types';

/** Track a custom event. Fire-and-forget; never blocks the JS thread. */
export function trackEvent(eventName: string, attributes?: GalvaAttributes): void {
  GalvaNative.trackEvent(eventName, attributes ?? null);
}
