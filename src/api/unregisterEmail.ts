import { GalvaNative } from '../NativeBridge';

/** Remove a previously-registered email endpoint. */
export function unregisterEmail(email: string): void {
  GalvaNative.unregisterEmail(email);
}
