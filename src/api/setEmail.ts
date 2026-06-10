import { GalvaNative } from '../NativeBridge';

/**
 * Set the current user's email trait (server key `$gv_email`).
 *
 * This only sets a profile trait. To register the address as a reachable
 * communication endpoint, use {@link registerEmail}.
 */
export function setEmail(email: string): void {
  GalvaNative.setEmail(email);
}
