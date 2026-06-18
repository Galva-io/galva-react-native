import { useCallback, useEffect, useRef, useState } from 'react';
import { identifiedUserId } from '../api/identifiedUserId';
import { isAnonymous } from '../api/isAnonymous';

/** Reactive identity snapshot returned by {@link useGalvaUser}. */
export interface GalvaUser {
  /** Identified user id, or `null` while anonymous / still loading. */
  userId: string | null;
  /** Whether the current identity is anonymous; `null` until the first read resolves. */
  isAnonymous: boolean | null;
  /** `true` until the initial read resolves (and during a {@link GalvaUser.refresh}). */
  loading: boolean;
  /** Re-read identity from the native core (call after `identify`/`logout`). */
  refresh: () => void;
}

/**
 * Read the current identity into React state. The native getters are queries
 * (they return data), so this awaits them **once** on mount — no native event
 * needed — and exposes a `refresh()` for after `identify`/`logout`.
 *
 * `identify` is eventually consistent (plan §4): a `refresh()` fired
 * immediately after it can still return the previous identity — refresh on the
 * next tick if you need the post-identify value.
 *
 * ```tsx
 * const { userId, isAnonymous, loading } = useGalvaUser();
 * ```
 */
export function useGalvaUser(): GalvaUser {
  const [user, setUser] = useState<{
    userId: string | null;
    isAnonymous: boolean | null;
  }>({ userId: null, isAnonymous: null });
  const [loading, setLoading] = useState(true);
  const aliveRef = useRef(true);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([identifiedUserId(), isAnonymous()])
      .then(([userId, anonymous]) => {
        if (!aliveRef.current) return;
        setUser({ userId, isAnonymous: anonymous });
        setLoading(false);
      })
      .catch(() => {
        if (!aliveRef.current) return;
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    refresh();
    return () => {
      aliveRef.current = false;
    };
  }, [refresh]);

  return { ...user, loading, refresh };
}
