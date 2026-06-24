import { Platform } from 'react-native';
import { GalvaNative } from '../native/GalvaNative';
import type { NativeGalvaConfig } from '../native/GalvaNative';
import { installDeepLinkForwarding } from '../internal/linking';
import { configureLogForwarding } from '../internal/logging';
import { wrapperIdentity } from '../internal/sdkIdentity';
import type { GalvaConfig } from '../types';
import { VERSION } from '../version';

/**
 * Initialize the SDK. Call once as early as possible (app entry, or via the
 * `useGalvaConfig` hook). Re-configuring is ignored by the native core. Also
 * installs deep-link forwarding via React Native's `Linking` API and, in dev,
 * mirrors SDK logs to the JS console (see `logToConsole` / `setLogger`).
 *
 * @example
 * configureSDK({ apiKey: 'gv_pub_xxx', environment: 'production', logLevel: 'warning' });
 */
export function configureSDK(config: GalvaConfig): void {
  // Build the native payload, including only the keys that are set
  // (exactOptionalPropertyTypes-friendly; the bridge drops absent keys).
  // `wrapper` is always set so the backend identifies this install as
  // react-native-<platform>/<package version> rather than inheriting the
  // vendored native core's `ios/<core version>` identity (see version.ts).
  const native: NativeGalvaConfig = {
    apiKey: config.apiKey,
    wrapper: wrapperIdentity(Platform.OS, VERSION),
  };
  if (config.environment !== undefined) native.environment = config.environment;
  if (config.logLevel !== undefined) native.logLevel = config.logLevel;
  if (config.autoTrack !== undefined) native.autoTrack = config.autoTrack;

  GalvaNative.configureSDK(native);
  installDeepLinkForwarding();
  configureLogForwarding(config.logToConsole);
}
