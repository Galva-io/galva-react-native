import { GalvaNative } from '../NativeBridge';

/**
 * Present an in-app message received from the {@link messages} emitter. The
 * native SDK renders it in a managed WebView sheet; bundle download, caching,
 * and the purchase/dismiss/deep-link bridge are handled internally.
 *
 * Idempotent while the message is on screen.
 *
 * Fire-and-forget (plan §4): returns `void`. A failed render
 * (`MESSAGE_NOT_FOUND` if the id wasn't delivered by the emitter / was
 * invalidated, `NOT_CONFIGURED` before {@link configure}, `BUNDLE_UNAVAILABLE`
 * when the WebView bundle can't load) is logged, never thrown — call
 * `GalvaNative.show` directly if you need to await the outcome.
 *
 * @param messageId `id` of a message delivered by {@link messages}.
 */
export function show(messageId: string): void {
  GalvaNative.show(messageId).catch((error: unknown) => {
    console.warn('Galva: show() failed —', error);
  });
}
