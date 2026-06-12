import { GalvaNative } from '../NativeBridge';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Identify the current end user. Subsequent events are attributed to this
 * user id until {@link logout} is called.
 *
 * Eventually consistent: the native core applies the identity asynchronously,
 * so {@link identifiedUserId} / {@link isAnonymous} read immediately after
 * this call may still return the previous state (holds on both platforms).
 *
 * @param userId Your app's stable identifier for the user.
 * @param options.appAccountToken Optional StoreKit 2 `appAccountToken` (UUID
 *   string) for linking subscription purchases to this user. iOS only —
 *   ignored on Android.
 *
 * ```ts
 * identify('user_42');
 * identify('user_42', { appAccountToken: '8e0f7c2a-…' });
 * ```
 */
export function identify(
  userId: string,
  options?: { appAccountToken?: string }
): void {
  const token = options?.appAccountToken;
  if (token != null && !UUID_RE.test(token)) {
    throw new TypeError(
      "Galva: identify() 'appAccountToken' must be a UUID string."
    );
  }
  GalvaNative.identify(userId, token ?? null);
}
