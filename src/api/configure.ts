import { GalvaNative } from '../NativeBridge';
import type { GalvaConfig } from '../types';

/**
 * Configure the SDK. Call once at app launch before any other Galva call.
 * Subsequent calls are ignored by the native core with a warning.
 *
 * Fire-and-forget: returns synchronously; work happens on a native actor.
 *
 * ```ts
 * configure({ apiKey: 'gv_pub_xxx', environment: 'production', logLevel: 'info' });
 * ```
 */
export function configure(config: GalvaConfig): void {
  if (!config || typeof config.apiKey !== 'string' || config.apiKey === '') {
    throw new TypeError("Galva: configure() requires a non-empty 'apiKey'.");
  }
  GalvaNative.configure(config);
}
