import { GalvaNative } from '../NativeBridge';
import type { UserPropertyValue } from '../types';

/**
 * Set multiple user traits at once — the bulk form of {@link setUserProperty}
 * (mirrors the iOS core's `AppUser.set([String: Any])`). Handy when traits
 * arrive together from an untyped source (a JSON parse, a stored profile).
 *
 * ```ts
 * setUserProperties({ plan_tier: 'pro', habit_count: 13, trial: false });
 * ```
 */
export function setUserProperties(
  properties: Record<string, UserPropertyValue>
): void {
  GalvaNative.setUserProperties(properties);
}
