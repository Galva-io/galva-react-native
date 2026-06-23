import { GalvaNative } from '../native/GalvaNative';

/**
 * Forward an APNs device token (hex string) to Galva. Only needed if you've
 * disabled auto-wiring (swizzling) or source the token from another push
 * library. The token is device-scoped — call it once; the SDK keeps it
 * associated across identity changes.
 */
export function registerAPNsToken(tokenHex: string): void {
  GalvaNative.registerAPNsToken(tokenHex);
}
