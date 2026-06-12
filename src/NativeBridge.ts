import { NativeEventEmitter, NativeModules } from 'react-native';
import type {
  CommunicationPreference,
  EventAttributes,
  GalvaConfig,
  UserPropertyValue,
} from './types';

// Internal — NOT re-exported from index.ts (plan §4). The single native module,
// exposed to JS as "Galva" (iOS remaps GalvaModule → "Galva"; Android
// getName() returns "Galva"). Deliberately a plain NativeModules lookup, not a
// TurboModule registry: version-agnostic, works on the oldest supported RN and
// on New Arch via the bridging interop layer.

const LINKING_ERROR =
  `The native module 'Galva' is not linked.\n` +
  `- Rebuild the app after installing '@galva/react-native'.\n` +
  `- A custom native build is required — Expo Go is not supported (use a dev build).\n`;

/** Wire shape of the "galva#message" event (`workflowType` absent when null). */
export type NativeGalvaMessage = {
  id: string;
  workflowType?: string;
  createdAt: number;
  rawType: string;
};

export const MESSAGE_EVENT = 'galva#message';

type GalvaNativeModule = {
  configure(config: GalvaConfig): void;
  setOptOut(enabled: boolean): void;
  isOptedOut(): Promise<boolean>;
  setDeviceToken(token: string): void;
  reconcileTransactions(): void;
  sdkVersion(): Promise<string>;
  track(eventName: string, attributes: EventAttributes | null): void;
  identify(userId: string, appAccountToken: string | null): void;
  logout(): void;
  identifiedUserId(): Promise<string | null>;
  isAnonymous(): Promise<boolean>;
  setEmail(email: string): void;
  setDisplayName(name: string): void;
  setUserProperty(key: string, value: UserPropertyValue): void;
  isValidEmail(email: string): Promise<boolean>;
  registerEmail(email: string): void;
  unregisterEmail(email: string): void;
  registerPushToken(token: string, platform: string | null): void;
  unregisterPushToken(token: string, platform: string | null): void;
  setCommunicationPreference(preference: CommunicationPreference): void;
  checkForMessages(): void;
  show(messageId: string): Promise<void>;
  // RCTEventEmitter / NativeEventEmitter contract.
  addListener(eventType: string): void;
  removeListeners(count: number): void;
};

export const GalvaNative: GalvaNativeModule = NativeModules.Galva
  ? NativeModules.Galva
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

// Lazy so merely importing the package never throws when the native module is
// absent (Expo Go, web tests) — only actually subscribing does (the emitter
// constructor touches addListener, which trips the linking-error proxy).
let emitter: NativeEventEmitter | null = null;

export function getGalvaEmitter(): NativeEventEmitter {
  if (emitter == null) {
    emitter = new NativeEventEmitter(GalvaNative);
  }
  return emitter;
}
