import { useEffect, useRef } from 'react';
import { addMessageObserver } from '../in-app-message/addMessageObserver';
import { showMessage } from '../in-app-message/showMessage';
import { toGalvaError } from '../GalvaError';
import type { GalvaError } from '../GalvaError';
import type { GalvaInAppMessage } from '../types';

export interface InAppMessageAutoPresenterProps {
  /** Decide whether to present a given message. Defaults to presenting all. */
  shouldShow?: (message: GalvaInAppMessage) => boolean;
  /** Called after a message is successfully presented. */
  onShow?: (message: GalvaInAppMessage) => void;
  /** Called if presentation fails. */
  onError?: (message: GalvaInAppMessage, error: GalvaError) => void;
}

/**
 * Drop-in component that auto-presents incoming in-app messages — the
 * hands-off path. Renders nothing; place one near your app root:
 *
 * ```tsx
 * <InAppMessageAutoPresenter shouldShow={(m) => m.workflowType === 'winback'} />
 * ```
 *
 * Use at most one (or one `useInAppMessages({ autoShow })`) to avoid presenting
 * the same message twice.
 */
export function InAppMessageAutoPresenter(
  props: InAppMessageAutoPresenterProps
): null {
  // Hold props in a ref so changing callbacks doesn't re-subscribe.
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const subscription = addMessageObserver((message) => {
      const { shouldShow, onShow, onError } = propsRef.current;
      if (shouldShow && !shouldShow(message)) return;
      void showMessage(message.id).then(
        () => onShow?.(message),
        (error: unknown) => onError?.(message, toGalvaError(error))
      );
    });
    return () => subscription.remove();
  }, []);

  return null;
}
