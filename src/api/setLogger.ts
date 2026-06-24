import { setCustomLogger } from '../internal/logging';
import type { GalvaLogger } from '../types';

/**
 * Install a custom logger to receive Galva's SDK logs and forward them into your
 * own pipeline — a remote log server, Sentry, Datadog, a file logger, etc. Pass
 * `null` to remove it and fall back to the dev-console default.
 *
 * The logger receives every entry that passes the configured `logLevel` (set via
 * `configureSDK`). Mirrors iOS's `Galva.setLogger(_:)`.
 *
 * ```ts
 * setLogger((entry) => {
 *   fetch('https://logs.example.com/ingest', {
 *     method: 'POST',
 *     body: JSON.stringify(entry),
 *   });
 * });
 * ```
 */
export function setLogger(logger: GalvaLogger | null): void {
  setCustomLogger(logger);
}
