import { GalvaNative } from '../NativeBridge';

/** Version of the underlying native Galva core (e.g. `"1.0.0"`). */
export function sdkVersion(): Promise<string> {
  return GalvaNative.sdkVersion();
}
