import { GalvaNative } from '../NativeBridge';

/**
 * Set the current user's full-name trait (server key `$gv_fullName`).
 */
export function setDisplayName(name: string): void {
  GalvaNative.setDisplayName(name);
}
