//
// @galva/react-native — public entry point.
//
// The API surface is built up across the `src/api/*` (one function per file),
// `src/react/*` (provider + hooks), and `src/types` modules. This file is the
// single re-export barrel consumers import from.
//

export type * from './types';

/** The JS package version. The native SDK version is `getSdkVersion()`. */
export const VERSION = '0.1.0';
