// PUBLIC ENTRY — re-export ONLY, one line per api/* export (plan §4).
// This is the single sanctioned barrel; keep it re-export-only with
// "sideEffects": false so bundlers tree-shake unused exports. Internal code
// must import from the source path, never through this file.

export { configure } from './api/configure';
export { track } from './api/track';
export { identify } from './api/identify';
export { logout } from './api/logout';
export { identifiedUserId } from './api/identifiedUserId';
export { isAnonymous } from './api/isAnonymous';
export { setEmail } from './api/setEmail';
export { setDisplayName } from './api/setDisplayName';
export { setUserProperty } from './api/setUserProperty';
export { setUserProperties } from './api/setUserProperties';
export { setOptOut } from './api/setOptOut';
export { isOptedOut } from './api/isOptedOut';
export { setDeviceToken } from './api/setDeviceToken';
export { reconcileTransactions } from './api/reconcileTransactions';
export { isValidEmail } from './api/isValidEmail';
export { registerEmail } from './api/registerEmail';
export { unregisterEmail } from './api/unregisterEmail';
export { registerPushToken } from './api/registerPushToken';
export { unregisterPushToken } from './api/unregisterPushToken';
export { setCommunicationPreference } from './api/setCommunicationPreference';
export { messages } from './api/messages';
export { show } from './api/show';
export { checkForMessages } from './api/checkForMessages';
export { sdkVersion } from './api/sdkVersion';

// React-first layer (plan §4) — additive convenience over the flat functions
// above. Path is './react/*', not './api/*', so parity-check ignores it.
export { Galva } from './react/Galva';
export { InAppMessageAutoShow } from './react/InAppMessageAutoShow';
export { useInAppMessages } from './react/useInAppMessages';
export { useGalvaUser } from './react/useGalvaUser';

export type { GalvaProps } from './react/Galva';
export type { InAppMessageAutoShowProps } from './react/InAppMessageAutoShow';
export type { GalvaUser } from './react/useGalvaUser';

export type {
  CommunicationChannel,
  CommunicationPreference,
  EventAttributes,
  GalvaConfig,
  GalvaEnvironment,
  GalvaLogLevel,
  InAppMessage,
  PushPlatform,
  UserPropertyValue,
  WorkflowType,
} from './types';
