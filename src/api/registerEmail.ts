import { GalvaNative } from '../NativeBridge';

/**
 * Register an email address as a reachable communication endpoint for the
 * current user. Invalid addresses are dropped natively with a warning —
 * validate up front with {@link isValidEmail} if you need to tell the user.
 */
export function registerEmail(email: string): void {
  GalvaNative.registerEmail(email);
}
