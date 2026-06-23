import { GalvaNative } from '../native/GalvaNative';
import { toWireAttributes } from '../internal/traits';
import type { GalvaUserAttributes } from '../types';

/**
 * Set one or more user attributes. Known traits (`email`, `fullName`,
 * `firstName`, `lastName`, `country`, `timezone`, `languageCode`,
 * `totalLifetimeValue`) map to Galva's canonical keys; any other key is sent as
 * a custom trait. Fire-and-forget.
 */
export function setUserAttributes(attributes: GalvaUserAttributes): void {
  GalvaNative.setUserAttributes(toWireAttributes(attributes));
}
