import { GalvaNative } from '../native/GalvaNative';
import type { GalvaAttributes } from '../types';

/**
 * Track a custom event. Fire-and-forget; never blocks the JS thread.
 *
 * @example
 * trackEvent('paywall_viewed', { plan: 'pro', price: 9.99 });
 * trackEvent('tutorial_completed'); // attributes optional
 */
export function trackEvent(eventName: string, attributes?: GalvaAttributes): void {
  GalvaNative.trackEvent(eventName, attributes ?? null);
}
