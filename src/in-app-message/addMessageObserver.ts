import { getGalvaEmitter, MESSAGE_EVENT } from '../native/events';
import type { NativeMessage } from '../native/events';
import type {
  GalvaInAppMessage,
  GalvaSubscription,
  GalvaWorkflowType,
} from '../types';

/**
 * Observe in-app messages as they arrive. The observer fires once per message;
 * decide whether to present it via `showMessage`. Returns a subscription — call
 * `.remove()` to stop observing.
 */
export function addMessageObserver(
  observer: (message: GalvaInAppMessage) => void
): GalvaSubscription {
  const subscription = getGalvaEmitter().addListener(
    MESSAGE_EVENT,
    (raw: NativeMessage) => {
      observer(toMessage(raw));
    }
  );
  return { remove: () => subscription.remove() };
}

function toMessage(raw: NativeMessage): GalvaInAppMessage {
  return {
    id: raw.id,
    createdAt: raw.createdAt,
    rawType: raw.rawType,
    ...(raw.workflowType !== undefined
      ? { workflowType: raw.workflowType as GalvaWorkflowType }
      : {}),
  };
}
