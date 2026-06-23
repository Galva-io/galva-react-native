import { useEffect } from 'react';
import { configureSDK } from '../api/configure';
import type { GalvaConfig } from '../types';

/**
 * Configure Galva once, the React way — drop it in your root component instead
 * of calling `configureSDK` imperatively:
 *
 * ```tsx
 * function App() {
 *   useGalvaConfig({ apiKey: 'gv_pub_…' });
 *   return <RootNavigator />;
 * }
 * ```
 *
 * Configures on mount only; re-renders and config changes are ignored (the
 * native core ignores re-configure). Also installs deep-link forwarding.
 */
export function useGalvaConfig(config: GalvaConfig): void {
  useEffect(() => {
    configureSDK(config);
    // Configure-once: deps intentionally empty. The native core ignores
    // re-configure, so reacting to `config` changes is a no-op at best.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
