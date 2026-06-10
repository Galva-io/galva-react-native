import { GalvaNative } from '../NativeBridge';

/**
 * Present an in-app message received from the {@link messages} emitter. The
 * native SDK renders it in a managed WebView sheet; bundle download, caching,
 * and the purchase/dismiss/deep-link bridge are handled internally.
 *
 * Idempotent while the message is on screen.
 *
 * @param messageId `id` of a message delivered by {@link messages}.
 * @throws `MESSAGE_NOT_FOUND` if the id wasn't delivered by the emitter (or
 *   the server invalidated it), `NOT_CONFIGURED` before {@link configure},
 *   `BUNDLE_UNAVAILABLE` when the message's WebView bundle can't be loaded.
 */
export function show(messageId: string): Promise<void> {
  return GalvaNative.show(messageId);
}
