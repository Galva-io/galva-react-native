import { setUserAttributes } from './setUserAttributes';
import type { GalvaUserAttributes } from '../types';

/**
 * Set a single user attribute — no need to resend the whole bag for one change.
 *
 * Type-safe: known traits enforce their value type, and any custom key accepts a
 * scalar. Mirrors iOS's `Galva.set(_:_:)`.
 *
 * ```ts
 * setUserAttribute('email', 'jane@example.com');     // string
 * setUserAttribute('totalLifetimeValue', 129.97);    // number
 * setUserAttribute('plan', 'pro');                   // custom (GalvaValue)
 * ```
 */
export function setUserAttribute<K extends keyof GalvaUserAttributes>(
  key: K,
  value: NonNullable<GalvaUserAttributes[K]>
): void {
  const attributes: GalvaUserAttributes = {};
  attributes[key] = value;
  setUserAttributes(attributes);
}
