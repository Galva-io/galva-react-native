//
// Typed access to the native module registered as `NativeModules.Galva`.
//
// This is the single low-level contract the `src/api/*` functions call through.
// It mirrors the Obj-C externs in ios/bridge/GalvaModule.m exactly. If the
// native module isn't linked (forgot `pod install`, or running in Expo Go),
// every access throws a clear, actionable error instead of `undefined is not a
// function`.
//

import { NativeModules, Platform } from 'react-native';

/** Shape of the `configureSDK` payload as the native side parses it. */
export interface NativeGalvaConfig {
  apiKey: string;
  environment?: string | { apiBaseURL: string; webviewBundleCDN: string };
  logLevel?: string;
  autoTrack?: { lifecycle?: boolean; appleSearchAds?: boolean };
  /**
   * SDK-identity override. Rebrands the `x-sdk-version` request header (and the
   * library context on every message) from the vendored native core's default
   * (`ios/<core version>`) to this name/version. `configureSDK` always sets it
   * to `react-native-<platform>/<package version>` so the backend can tell a
   * React Native install apart from a native iOS one — otherwise RN traffic is
   * untraceable. Maps to the core's `Galva.configure(wrapper:)`.
   */
  wrapper?: { name: string; version: string };
}

/** Forwarded notification interaction (manual / opt-out path). */
export interface NativeNotificationResponse {
  id: string;
  userInfo: Record<string, unknown>;
  action?: 'default' | 'dismiss';
}

/** The native module contract. 1:1 with the Obj-C externs. */
export interface GalvaNativeModule {
  configureSDK(options: NativeGalvaConfig): void;
  setOptOut(enabled: boolean): void;
  isOptedOut(): Promise<boolean>;
  reconcileTransactions(): void;
  getSDKVersion(): Promise<string>;

  trackEvent(eventName: string, attributes: Record<string, unknown> | null): void;

  identifyUser(userId: string, appAccountToken: string | null): void;
  logOut(): void;
  getIdentifiedUserId(): Promise<string | null>;
  getAppAccountToken(): Promise<string | null>;
  setUserAttributes(attributes: Record<string, unknown>): void;

  registerAPNsToken(tokenHex: string): void;
  registerFCMToken(token: string): void;
  handleNotificationResponse(payload: NativeNotificationResponse): void;

  handleDeepLink(url: string): Promise<boolean>;

  showMessage(messageId: string): Promise<void>;

  // Toggle native→JS log forwarding (the `galva#log` event stream). Enabled by
  // the JS logging layer in dev or when a custom logger is set; off otherwise so
  // release builds pay nothing.
  setLogForwarding(enabled: boolean): void;

  // Provided natively by RCTEventEmitter; required for NativeEventEmitter.
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

const LINKING_ERROR =
  `The package '@galva/react-native' doesn't seem to be linked. Make sure:\n\n` +
  Platform.select({ ios: "  • You ran 'pod install'\n", default: '' }) +
  '  • You rebuilt the app after installing the package\n' +
  '  • You are not using Expo Go (use a development build)';

const linked = (NativeModules as Record<string, GalvaNativeModule | undefined>)[
  'Galva'
];

/** The native module, or a proxy that throws a helpful error if not linked. */
export const GalvaNative: GalvaNativeModule =
  linked ??
  new Proxy({} as GalvaNativeModule, {
    get() {
      throw new Error(LINKING_ERROR);
    },
  });

/** Whether the native module is present (false on Android until implemented). */
export const isGalvaLinked = linked != null;
