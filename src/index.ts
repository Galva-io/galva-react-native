//
// @galva/react-native — root entry point (imperative core).
//
// In-app message helpers live in "@galva/react-native/in-app-message"; React
// helpers in "@galva/react-native/react".
//

export type * from './types';
export { GalvaError } from './GalvaError';
export type { GalvaErrorCode } from './GalvaError';

export { configureSDK } from './api/configure';
export { trackEvent } from './api/track';
export { identifyUser } from './api/identify';
export { getIdentifiedUserId } from './api/getIdentifiedUserId';
export { logOut } from './api/logOut';
export { setUserAttributes } from './api/setUserAttributes';
export { registerAPNsToken } from './api/registerAPNsToken';
export { registerFCMToken } from './api/registerFCMToken';
export { handleNotificationResponse } from './api/handleNotificationResponse';
export { handleDeepLink } from './api/handleDeepLink';
export { setOptOut } from './api/setOptOut';
export { isOptedOut } from './api/isOptedOut';
export { reconcileTransactions } from './api/reconcileTransactions';
export { getSDKVersion } from './api/getSDKVersion';
export { setLogger } from './api/setLogger';

/** The JS package version. The native SDK version is `getSDKVersion()`. */
export const VERSION = '0.1.0';
