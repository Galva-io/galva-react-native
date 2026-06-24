import { GalvaNative } from '../native/GalvaNative';

/**
 * The native Galva SDK version (the vendored iOS core's version).
 *
 * @example
 * const version = await getSDKVersion(); // e.g. "1.0.0"
 */
export function getSDKVersion(): Promise<string> {
  return GalvaNative.getSDKVersion();
}
