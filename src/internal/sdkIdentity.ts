//
// SDK-identity helper.
//
// The React Native SDK reports a distinct identity to the Galva backend so its
// traffic is traceable separately from the native iOS/Android cores it wraps:
// `react-native-<platform>/<package version>` (e.g. `react-native-ios/0.1.0`),
// sent by the native core as the `x-sdk-version` request header and the
// per-message library context.
//
// Kept pure (no `react-native` import) so it's unit-testable without a RN
// runtime — see scripts/test-identity.ts. `configureSDK` feeds it RN's
// `Platform.OS` plus the generated `VERSION` (src/version.ts).
//

/**
 * Build the SDK-identity wrapper the native bridge forwards to the core's
 * `Galva.configure(wrapper:)`. The core rebrands its `x-sdk-version` header and
 * library context to `<name>/<version>`.
 *
 * @param platformOS React Native's `Platform.OS` (`'ios'`, `'android'`, …).
 * @param version    The `@galva/react-native` package version (`VERSION`).
 */
export function wrapperIdentity(
  platformOS: string,
  version: string
): { name: string; version: string } {
  return { name: `react-native-${platformOS}`, version };
}
