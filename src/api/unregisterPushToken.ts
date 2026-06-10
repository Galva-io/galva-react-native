import { GalvaNative } from '../NativeBridge';
import type { PushPlatform } from '../types';

/** Remove a previously-registered push-notification endpoint. */
export function unregisterPushToken(
  token: string,
  platform?: PushPlatform
): void {
  GalvaNative.unregisterPushToken(token, platform ?? null);
}
