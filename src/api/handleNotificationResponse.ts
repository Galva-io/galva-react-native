import { GalvaNative } from '../native/GalvaNative';
import type { GalvaNotificationResponse } from '../types';

/**
 * Forward a notification interaction to Galva for tap/dismiss tracking. Only
 * needed if you've disabled auto-wiring (swizzling) or own the notification
 * delegate via another push library. Galva tracks only its own notifications
 * (those carrying the `"sender": "galva"` marker). `action` defaults to a tap.
 */
export function handleNotificationResponse(
  response: GalvaNotificationResponse
): void {
  GalvaNative.handleNotificationResponse({
    id: response.id,
    userInfo: response.userInfo,
    action: response.action ?? 'default',
  });
}
