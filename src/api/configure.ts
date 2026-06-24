import { GalvaNative } from '../native/GalvaNative';
import type { NativeGalvaConfig } from '../native/GalvaNative';
import { installDeepLinkForwarding } from '../internal/linking';
import { configureLogForwarding } from '../internal/logging';
import type { GalvaConfig } from '../types';

/**
 * Initialize the SDK. Call once as early as possible (app entry, or via the
 * `useGalvaConfig` hook). Re-configuring is ignored by the native core. Also
 * installs deep-link forwarding via React Native's `Linking` API and, in dev,
 * mirrors SDK logs to the JS console (see `logToConsole` / `setLogger`).
 */
export function configureSDK(config: GalvaConfig): void {
  // Build the native payload, including only the keys that are set
  // (exactOptionalPropertyTypes-friendly; the bridge drops absent keys).
  const native: NativeGalvaConfig = { apiKey: config.apiKey };
  if (config.environment !== undefined) native.environment = config.environment;
  if (config.logLevel !== undefined) native.logLevel = config.logLevel;
  if (config.autoTrack !== undefined) native.autoTrack = config.autoTrack;

  GalvaNative.configureSDK(native);
  installDeepLinkForwarding();
  configureLogForwarding(config.logToConsole);
}
