import { useEffect, useRef } from 'react';
import { messages } from '../api/messages';
import type { InAppMessage } from '../types';

/**
 * Subscribe to in-app messages for the component's lifetime — the hook form of
 * {@link messages}, auto-unsubscribing on unmount. The controlled path: you
 * decide when (and whether) to {@link show} each message.
 *
 * ```tsx
 * useInAppMessages((message) => {
 *   if (message.workflowType !== 'trial-rescue') show(message.id);
 * });
 * ```
 *
 * The handler may be an inline closure — the latest one is always used and the
 * subscription is never torn down between renders.
 */
export function useInAppMessages(
  handler: (message: InAppMessage) => void
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => messages((message) => handlerRef.current(message)), []);
}
