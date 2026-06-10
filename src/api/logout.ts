import { GalvaNative } from '../NativeBridge';

/**
 * Log out the current user. Clears the identified user id and rotates the
 * anonymous id so subsequent events are attributed to a fresh anonymous
 * session.
 */
export function logout(): void {
  GalvaNative.logout();
}
