import { GalvaNative } from '../NativeBridge';
import type { PushPlatform } from '../types';

/**
 * Register a device token as a push-notification endpoint.
 *
 * @param token Hex-encoded APNs token or FCM registration token.
 * @param platform `'apns'` (default) or `'fcm'`.
 */
export function registerPushToken(
  token: string,
  platform?: PushPlatform
): void {
  GalvaNative.registerPushToken(token, platform ?? null);
}
