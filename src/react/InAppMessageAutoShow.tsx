import { show } from '../api/show';
import { useInAppMessages } from './useInAppMessages';
import type { InAppMessage } from '../types';

/** Props for {@link InAppMessageAutoShow}. */
export interface InAppMessageAutoShowProps {
  /**
   * Return `false` to suppress a message (e.g. hold surveys until later).
   * Omit to show everything.
   */
  filter?: (message: InAppMessage) => boolean;
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
  filter,
}: InAppMessageAutoShowProps = {}): null {
  useInAppMessages((message) => {
    if (filter && !filter(message)) return;
    show(message.id);
  });

  return null;
}
