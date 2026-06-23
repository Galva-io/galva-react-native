//
// Native event stream plumbing for in-app messages.
//
// The native bridge (RCTEventEmitter) emits one event per pending in-app
// message off `InAppMessages.messages`. The public `addMessageObserver` /
// `useInAppMessages` build on the shared emitter created here.
//

import { NativeEventEmitter } from 'react-native';
import { GalvaNative } from './GalvaNative';

/** Native event name carrying each in-app message. Matches the Swift bridge. */
export const MESSAGE_EVENT = 'galva#message';

/** Raw in-app message payload as emitted by the native bridge. */
export interface NativeMessage {
  id: string;
  /** Epoch milliseconds. */
  createdAt: number;
  rawType: string;
  workflowType?: string;
}

type EmitterModuleArg = ConstructorParameters<typeof NativeEventEmitter>[0];

let emitter: NativeEventEmitter | undefined;

/**
 * Lazily-created shared emitter over the native module. Lazy so merely importing
 * the package doesn't construct an emitter before the module is ready.
 */
export function getGalvaEmitter(): NativeEventEmitter {
  if (!emitter) {
    emitter = new NativeEventEmitter(GalvaNative as unknown as EmitterModuleArg);
  }
  return emitter;
}
