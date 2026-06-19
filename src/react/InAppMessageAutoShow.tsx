import { show } from '../api/show';
import { useInAppMessages } from './useInAppMessages';
import type { InAppMessage } from '../types';

/** Props for {@link InAppMessageAutoShow}. */
export interface InAppMessageAutoShowProps {
  /**
   * Gate which messages auto-show. Pass a predicate (return `false` to suppress
   * a message — e.g. hold surveys until later) or a plain boolean to toggle all
   * messages on/off. Omit to show everything.
   */
  shouldShowMessage?: boolean | ((message: InAppMessage) => boolean);
}

/**
 * Drop-in that auto-renders every in-app message the backend serves — the RN
 * equivalent of SwiftUI's `.autoDisplayInAppMessages()`. Renders nothing.
 *
 * ```tsx
 * <Galva apiKey="gv_pub_xxx">
 *   <App />
 *   <InAppMessageAutoShow />
 * </Galva>
 * ```
 *
 * For full control over presentation, drop down to {@link useInAppMessages}.
 */
export function InAppMessageAutoShow({
  shouldShowMessage = true,
}: InAppMessageAutoShowProps = {}): null {
  useInAppMessages((message) => {
    const allowed =
      typeof shouldShowMessage === 'function'
        ? shouldShowMessage(message)
        : shouldShowMessage;
    if (!allowed) return;
    show(message.id);
  });

  return null;
}
