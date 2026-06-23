import { GalvaNative } from '../native/GalvaNative';

/** Clear the identified user and rotate to a fresh anonymous id. */
export function logOut(): void {
  GalvaNative.logOut();
}
