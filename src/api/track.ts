import { GalvaNative } from '../NativeBridge';
import type { EventAttributes } from '../types';

/**
 * Track an event. The event is queued, persisted to disk natively, and
 * uploaded asynchronously — it survives crashes and offline periods.
 *
 * Attribute values must be JSON-compatible; the native core silently drops
 * anything that isn't.
 *
 * ```ts
 * track('AddHabitButtonTapped');
 * track('Purchase', { sku: 'pro_yearly', price: 9.99 });
 * ```
 */
export function track(eventName: string, attributes?: EventAttributes): void {
  GalvaNative.track(eventName, attributes ?? null);
}
