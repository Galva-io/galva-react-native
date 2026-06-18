import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { configure } from '../api/configure';
import type { GalvaConfig } from '../types';

/** Props for {@link Galva} — the full {@link GalvaConfig} plus `children`. */
export interface GalvaProps extends GalvaConfig {
  children?: ReactNode;
}

/**
 * Provider that calls {@link configure} once on mount, replacing the
 * `useEffect(() => configure(…), [])` boilerplate. Wrap your app:
 *
 * ```tsx
 * <Galva apiKey="gv_pub_xxx">
 *   <App />
 * </Galva>
 * ```
 *
 * No React Context — the native SDK is the singleton source of truth. The
 * config is read once; the native core ignores re-configure, so props that
 * change after mount have no effect (matching that contract).
 */
export function Galva({ children, ...config }: GalvaProps): ReactNode {
  useEffect(() => {
    configure(config);
    // Configure once: the native core ignores re-configure (logs a warning),
    // so re-running on a prop change is a no-op at best, noise at worst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return children;
}
