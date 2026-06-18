import { getGalvaEmitter, MESSAGE_EVENT } from '../NativeBridge';
import type { NativeGalvaMessage } from '../NativeBridge';
import type { InAppMessage, WorkflowType } from '../types';

/**
 * Subscribe to pending in-app messages addressed to the current identity.
 * The SDK publishes the winning message after each foreground poll. Render a
 * message by passing its `id` to {@link show}.
 *
 * Firebase-style emitter (plan §4): returns a plain `unsubscribe` function.
 *
 * ```ts
 * const unsubscribe = messages((message) => {
 *   show(message.id);
 * });
 * // later
 * unsubscribe();
 * ```
 */
export function messages(
  listener: (message: InAppMessage) => void
): () => void {
  const subscription = getGalvaEmitter().addListener(MESSAGE_EVENT, (raw) => {
    const event = raw as NativeGalvaMessage;
    listener({
      id: event.id,
      workflowType: (event.workflowType as WorkflowType | undefined) ?? null,
      createdAt: event.createdAt,
      rawType: event.rawType,
    });
  });
  return () => subscription.remove();
}
