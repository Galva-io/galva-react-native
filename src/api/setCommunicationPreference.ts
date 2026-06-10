import { GalvaNative } from '../NativeBridge';
import type { CommunicationPreference } from '../types';

/**
 * Update communication preferences for a channel.
 *
 * ```ts
 * // Opt the user out of payment-recovery emails:
 * setCommunicationPreference({
 *   channel: 'email',
 *   categories: { 'payment-recovery': false },
 * });
 * ```
 */
export function setCommunicationPreference(
  preference: CommunicationPreference
): void {
  GalvaNative.setCommunicationPreference(preference);
}
