import { GalvaNative } from '../native/GalvaNative';

/**
 * Clear the identified user and rotate to a fresh anonymous id.
 *
 * @example
 * logOut(); // e.g. on sign-out
 */
export function logOut(): void {
  GalvaNative.logOut();
}
