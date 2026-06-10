import { GalvaNative } from '../NativeBridge';
import type { UserPropertyValue } from '../types';

/**
 * Set an arbitrary user trait by key.
 *
 * ```ts
 * setUserProperty('plan_tier', 'pro');
 * setUserProperty('habit_count', 13);
 * ```
 */
export function setUserProperty(key: string, value: UserPropertyValue): void {
  GalvaNative.setUserProperty(key, value);
}
