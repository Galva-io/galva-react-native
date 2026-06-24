import { GalvaNative } from '../native/GalvaNative';

/**
 * Forward an FCM registration token to Galva.
 *
 * @remarks Android only. iOS uses APNs and ignores this call — use
 * {@link registerAPNsToken} on iOS.
 *
 * @example
 * registerFCMToken(await messaging().getToken());
 */
export function registerFCMToken(token: string): void {
  GalvaNative.registerFCMToken(token);
}
