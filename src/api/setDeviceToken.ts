import { GalvaNative } from '../NativeBridge';

/**
 * Attach an APNs / FCM device token to outgoing messages. Required before
 * registering the device for push via {@link registerPushToken}.
 *
 * ```ts
 * // iOS: hex-encode the token from didRegisterForRemoteNotifications
 * setDeviceToken(hexToken);
 * ```
 */
export function setDeviceToken(token: string): void {
  GalvaNative.setDeviceToken(token);
}
