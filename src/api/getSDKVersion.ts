import { GalvaNative } from '../native/GalvaNative';

/** The native Galva SDK version (the vendored iOS core's version). */
export function getSDKVersion(): Promise<string> {
  return GalvaNative.getSDKVersion();
}
