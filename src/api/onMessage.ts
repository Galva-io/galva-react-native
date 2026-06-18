import { getGalvaEmitter, MESSAGE_EVENT } from '../NativeBridge';
import type { NativeGalvaMessage } from '../NativeBridge';
import type { InAppMessage, WorkflowType } from '../types';

/**
 * Subscribe to pending in-app messages addressed to the current identity. The
 * callback fires once per message the SDK publishes after each foreground
 * poll; render one by passing its `id` to {@link show}.
 *
 * Firebase-style emitter (plan §4, like `onSnapshot`): returns a plain
 * `unsubscribe` function — call it to stop listening.
 *
 * ```ts
 * const unsubscribe = onMessage((message) => {
 *   show(message.id);
 * });
 * // later
 * unsubscribe();
 * ```
 */
export function onMessage(
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
