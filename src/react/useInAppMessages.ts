import { useEffect, useState } from 'react';
import { addMessageObserver } from '../in-app-message/addMessageObserver';
import type { GalvaInAppMessage } from '../types';

/**
 * Subscribe to in-app messages and get the most recent one (or `null`). You
 * decide whether/when to present it — the subscription lifecycle is handled.
 *
 * ```tsx
 * const message = useInAppMessages();
 * useEffect(() => {
 *   if (message) showMessage(message.id);
 * }, [message]);
 * ```
 */
export function useInAppMessages(): GalvaInAppMessage | null {
  const [message, setMessage] = useState<GalvaInAppMessage | null>(null);

  useEffect(() => {
    const subscription = addMessageObserver(setMessage);
    return () => subscription.remove();
  }, []);

  return message;
}
