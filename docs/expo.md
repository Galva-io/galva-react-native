# Using Galva with Expo

Galva supports Expo **via development builds** — the standard path for any
library with custom native code (same as Firebase, RevenueCat, …).

- **Expo Go is not supported.** Expo Go is a prebuilt binary; Galva's native
  code (the bridge + the compiled-in iOS core) can't be injected into it.
  Importing the package in Expo Go won't crash — but the first actual call
  throws a linking error.
- **The managed/CNG workflow IS supported.** You keep `app.json`-driven
  config and JS hot reload; you just run a dev build instead of Expo Go.

## Setup

```sh
npx expo install expo-dev-client       # one-time
npm install @galva/react-native
```

```jsonc
// app.json
{
  "expo": {
    "plugins": ["@galva/react-native"]
  }
}
```

```sh
npx expo prebuild        # CNG projects — regenerates android/ + ios/
npx expo run:ios         # or run:android, or build remotely with EAS
```

Daily development is unchanged afterwards: `npx expo start`, scan from the
dev build, hot-reload JS. Rebuild the native app only when native deps change.

## What the config plugin injects

Listed in `plugins`, `@galva/react-native` idempotently adds at prebuild:

| Platform | Injection |
|---|---|
| iOS | `aps-environment` entitlement; `UIBackgroundModes += remote-notification`; raises `ios.deploymentTarget` to 15.0 **only if the project pins something lower** (never lowers/creates it — SDK 53+ templates already default ≥ 15.1) |
| Android | `POST_NOTIFICATIONS` permission (Android 13+); raises an explicitly-pinned `android.minSdkVersion` below 24 (template defaults already satisfy it) |

Options:

```jsonc
// App doesn't use Galva's push channel → skip the push-related injections:
{ "plugins": [["@galva/react-native", { "push": false }]] }
```

`INTERNET` permission and the in-app-message Activity come from the Android
core's own manifest (merged automatically) — the plugin doesn't need to add
them.

## EAS Build

Nothing special: the default EAS image already runs **Xcode 26** (Apple
requires Xcode 26 for App Store uploads since 2026-04-28), which is exactly
Galva's floor. Only caveat: a project pinning an old `image` in `eas.json`
must drop the pin / use `auto`.

## Architectures

Works on both: New Architecture (Expo's default — the bridge runs through
RN's interop layer) and the Old Architecture on SDKs that still allow the
opt-out (`"newArchEnabled": false`, last supported in SDK 54). Both are
exercised continuously by the apps in
[`examples-compat/`](../examples-compat/README.md).

## Push notifications

See [push-notifications.md](push-notifications.md) — Expo section included
(`expo-notifications` token + the plugin handles project config).
