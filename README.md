# @galva/react-native

React Native SDK for [Galva](https://galva.io) — the subscription retention platform.

> **Status:** in active development. The public API may change before `1.0`.

A thin, fully-typed React Native layer over the first-party native Galva SDKs.
iOS wraps the Swift core (vendored into the pod); **Android is on the roadmap**
(the JS API is cross-platform-shaped and no-ops on Android until its core lands).

- **TypeScript-first** — strict, fully typed surface.
- **Old + New Architecture** — works across React Native `0.70`+ (the native
  module runs on the New Architecture via the interop layer).
- **Non-blocking** — every call is fire-and-forget or promise-based; nothing
  blocks the JS thread.
- **Zero-setup linking & push observation** — deep links flow through RN's
  `Linking`; the APNs token + notification taps are captured automatically on iOS.
- **Bare and Expo** — ships an Expo config plugin so managed apps make no manual
  native edits.

## Contents

- [Requirements](#requirements)
- [Install](#install) — [Bare](#bare-react-native) · [Expo](#expo)
- [Configure](#configure)
- [Common usage](#common-usage) — events, identity, user attributes, opt-out
- [In-app messages](#in-app-messages) — hooks & components
- [Deep linking](#deep-linking)
- [Push & swizzling (iOS)](#push--swizzling-ios)
- [Logging](#logging) — dev console & custom logger
- [API reference](#api-reference)
- [Native SDKs](#native-sdks)
- [Troubleshooting](#troubleshooting)

## Requirements

| | |
|---|---|
| React Native | `>= 0.70` (old or new architecture) |
| iOS deployment target | `15.0`+ |
| Build toolchain (iOS) | **Xcode 26+** — the Swift core compiles against the iOS 26 SDK. See [`docs/ios-build.md`](./docs/ios-build.md). |
| Expo | a **dev build** (`expo prebuild` / EAS dev client) — **not Expo Go** (Galva ships a native module). See [`docs/expo.md`](./docs/expo.md). |
| Android | coming soon |

## Install

```sh
npm install @galva/react-native
```

### Bare React Native

```sh
cd ios && pod install
```

That's it — the pod is autolinked. (Deep-link URL schemes still need registering;
see [Deep linking](#deep-linking).)

### Expo

Add the config plugin to `app.json` (or `app.config.js`) and prebuild:

```json
{
  "expo": {
    "plugins": [
      ["@galva/react-native", { "deepLinkScheme": "gvabc123" }]
    ]
  }
}
```

```sh
npx expo prebuild
```

The plugin registers your [deep-link scheme](#deep-linking) and the iOS
deployment-target floor for you. Galva needs a **dev build** — it can't run in
Expo Go. Full details in [`docs/expo.md`](./docs/expo.md).

## Configure

Get your **publishable API key** (`gv_pub_…`) from your Galva dashboard, then
configure the SDK once, as early as possible.

The idiomatic way is the `useGalvaConfig` hook at your app root:

```tsx
import { useGalvaConfig } from '@galva/react-native/react';

export default function App() {
  useGalvaConfig({ apiKey: 'gv_pub_xxx' });
  return <YourApp />;
}
```

Or call `configureSDK` imperatively (e.g. in your entry file) — equivalent, and
re-calls are ignored by the native core:

```ts
import { configureSDK } from '@galva/react-native';

configureSDK({
  apiKey: 'gv_pub_xxx',
  environment: 'production', // 'production' (default) | 'development' | custom
  logLevel: 'warning', // 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'fault' | 'off'
  autoTrack: { lifecycle: true, appleSearchAds: true }, // both default true
});
```

`configureSDK` also installs deep-link forwarding and, in development, mirrors SDK
logs to your JS console (see [Logging](#logging)).

## Common usage

```ts
import {
  trackEvent,
  identifyUser,
  getIdentifiedUserId,
  setUserAttribute,
  setUserAttributes,
  logOut,
  setOptOut,
  isOptedOut,
} from '@galva/react-native';
```

### Track events

```ts
trackEvent('paywall_viewed', { plan: 'pro', price: 9.99, source: 'settings' });
trackEvent('tutorial_completed'); // attributes are optional
```

### Identify the user

```ts
// Tie activity to your user id. Optionally link StoreKit purchases via the
// appAccountToken (a UUID you also pass to StoreKit).
identifyUser('user_123', { appAccountToken: '7e1c…-uuid' });

const id = await getIdentifiedUserId(); // string | null
logOut(); // clear identity (e.g. on sign-out)
```

### Set user attributes (email, name, …)

Known traits are typed; you can also pass any custom scalar:

```ts
setUserAttributes({
  email: 'jane@example.com',
  fullName: 'Jane Doe',
  country: 'US',
  timezone: 'America/New_York',
  languageCode: 'en',
  totalLifetimeValue: 129.97,
  plan: 'pro', // custom attribute (string | number | boolean | null)
});

// Or set a single attribute — no need to resend the whole bag. Type-safe:
// known traits enforce their value type; custom keys accept any scalar.
setUserAttribute('email', 'jane@example.com');
setUserAttribute('totalLifetimeValue', 129.97);
setUserAttribute('plan', 'pro');
```

> Invalid emails are dropped before they're sent.

### Opt-out (privacy)

```ts
setOptOut(true); // stop all tracking + collection
const optedOut = await isOptedOut();
```

## In-app messages

Galva delivers in-app messages server-side; the SDK surfaces the newest pending
message, and you decide when/whether to present it (rendered natively in a
WebView sheet). There are three ways to consume them.

### Auto-present (drop-in)

Mount `<InAppMessageAutoPresenter />` anywhere inside your app — it presents
messages as they arrive:

```tsx
import { InAppMessageAutoPresenter } from '@galva/react-native/react';

export default function App() {
  useGalvaConfig({ apiKey: 'gv_pub_xxx' });
  return (
    <>
      <YourApp />
      <InAppMessageAutoPresenter
        shouldShow={(m) => m.workflowType !== 'trial-rescue'} // optional filter
        onShow={(m) => console.log('shown', m.id)}
        onError={(m, err) => console.warn(err.code, m.id)}
      />
    </>
  );
}
```

### Hook (manual control)

`useInAppMessages` returns the newest message (or `null`); call `showMessage`
when you're ready:

```tsx
import { useInAppMessages } from '@galva/react-native/react';
import { showMessage } from '@galva/react-native/in-app-message';

function RetentionGate() {
  const message = useInAppMessages();
  useEffect(() => {
    if (message) showMessage(message.id).catch((e) => console.warn(e.code));
  }, [message]);
  return null;
}
```

### Imperative (no React)

```ts
import { addMessageObserver, showMessage } from '@galva/react-native/in-app-message';

const sub = addMessageObserver((message) => {
  showMessage(message.id).catch((e) => console.warn(e.code));
});
// later
sub.remove();
```

A message is `{ id, createdAt, rawType, workflowType? }`. `showMessage(id)`
rejects with a `GalvaError` (e.g. `MESSAGE_NOT_FOUND`, `BUNDLE_UNAVAILABLE`) if it
can't be presented.

## Deep linking

Galva assigns your app a **deep-link URL scheme** that begins with `gv`
(e.g. `gvabc123`). **Find it in your Galva dashboard** (per-app settings). Once
the scheme is registered with the OS, the SDK claims matching links automatically
— `configureSDK` forwards them through RN's `Linking` API, so there are **no**
AppDelegate/scene edits.

### Expo

Pass the scheme to the config plugin — it wires up iOS `CFBundleURLTypes` and the
Android launcher `intent-filter` for you:

```json
{
  "expo": {
    "plugins": [
      ["@galva/react-native", { "deepLinkScheme": "gvabc123" }]
    ]
  }
}
```

`deepLinkScheme` also accepts an array (`["gvabc123", "gvdef456"]`).

### Bare React Native

The plugin isn't read in bare apps, so register the scheme yourself (standard
iOS/Android URL-scheme setup):

**iOS** — `ios/<App>/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array><string>gvabc123</string></array>
  </dict>
</array>
```

**Android** — add an intent-filter to your launcher `<activity>` in
`AndroidManifest.xml`:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="gvabc123" />
</intent-filter>
```

To forward a URL manually (e.g. from a custom router), call
`handleDeepLink(url)` → resolves `true` if Galva claimed it.

## Push & swizzling (iOS)

To track push interactions, Galva needs to see two things: the **APNs device
token** and **notification taps/dismissals**. On iOS the SDK captures both
automatically via lightweight method swizzling — **no delegate code required**.
It's safe and well-tested (it chains to your existing delegate methods and never
drops another library's callbacks); it only tracks Galva-originated notifications
(those with a `sender: "galva"` marker).

> **You still set up push capability.** Galva only *observes*. Enabling push —
> the `aps-environment` entitlement, `UIBackgroundModes`, the Android
> `POST_NOTIFICATIONS` permission, and requesting authorization — is your app's
> job (e.g. with [`expo-notifications`](https://docs.expo.dev/push-notifications/overview/)).

### Enable / disable swizzling

Swizzling is **on by default**. To opt out:

- **Expo** — set the plugin prop:

  ```json
  ["@galva/react-native", { "swizzle": false }]
  ```

- **Bare** — set `GalvaSwizzlingEnabled` to `NO` in `Info.plist`.

When disabled, forward the two signals yourself:

```ts
import { registerAPNsToken, handleNotificationResponse } from '@galva/react-native';

// in your AppDelegate's didRegisterForRemoteNotificationsWithDeviceToken bridge:
registerAPNsToken(tokenHexString);

// when a notification is tapped/dismissed:
handleNotificationResponse({ id, userInfo, action: 'default' /* or 'dismiss' */ });
```

(`registerFCMToken` exists for cross-platform call sites; it's an Android concern
and a no-op on iOS today.)

## Logging

The SDK logs what it's doing through the iOS core's structured logger. You can
**view** those logs in development and **forward** them to your own pipeline.

### View in development

By default, in `__DEV__`, SDK logs print to your Metro/JS console with a colored,
level-prefixed format. Control verbosity with `logLevel`; silence with
`logToConsole: false`:

```ts
configureSDK({ apiKey: 'gv_pub_xxx', logLevel: 'debug' });
// INFO   [galva:queue] drained 5 messages
// WARN   [galva:uploader] retryable failure { status: '503' }
```

Each line is prefixed with its level (`DEBUG`/`INFO`/`NOTICE`/`WARN`/`ERROR`/
`FAULT`), ANSI-colored by severity (rendered in the Metro terminal). On iOS you
can also view logs in Console.app / Xcode under subsystem `co.galva.sdk`.

### Custom logger (advanced)

Install a custom logger to forward structured entries to a remote log server,
Sentry, Datadog, etc. It receives every entry that passes `logLevel`, in dev and
release (mirrors iOS's `Galva.setLogger`):

```ts
import { setLogger } from '@galva/react-native';
import type { GalvaLogEntry } from '@galva/react-native';

setLogger((entry: GalvaLogEntry) => {
  // { level, category, message, metadata?, error?, timestamp }
  fetch('https://logs.example.com/ingest', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
});

setLogger(null); // remove; back to the dev-console default
```

`logLevel` is the single cutoff for both the console and a custom logger. Logs
originate from the iOS core today; Android forwards nothing until its core lands.

## API reference

Imported from `@galva/react-native`:

| Function | Signature | Notes |
|---|---|---|
| `configureSDK` | `(config: GalvaConfig) => void` | Call once. |
| `trackEvent` | `(name: string, attributes?: GalvaAttributes) => void` | |
| `identifyUser` | `(userId: string, options?: { appAccountToken?: string }) => void` | |
| `getIdentifiedUserId` | `() => Promise<string \| null>` | |
| `logOut` | `() => void` | |
| `setUserAttribute` | `<K>(key: K, value) => void` | single typed/custom trait |
| `setUserAttributes` | `(attributes: GalvaUserAttributes) => void` | typed traits + custom (bulk) |
| `setOptOut` | `(optedOut: boolean) => void` | |
| `isOptedOut` | `() => Promise<boolean>` | |
| `handleDeepLink` | `(url: string) => Promise<boolean>` | manual forward |
| `registerAPNsToken` | `(tokenHex: string) => void` | swizzling escape hatch |
| `handleNotificationResponse` | `(response: GalvaNotificationResponse) => void` | swizzling escape hatch |
| `registerFCMToken` | `(token: string) => void` | Android; iOS no-op |
| `reconcileTransactions` | `() => void` | force a StoreKit sweep |
| `getSDKVersion` | `() => Promise<string>` | native core version |
| `setLogger` | `(logger: GalvaLogger \| null) => void` | custom log sink |

From `@galva/react-native/in-app-message`: `showMessage(id)`,
`addMessageObserver(fn)`.
From `@galva/react-native/react`: `useGalvaConfig(config)`, `useInAppMessages()`,
`<InAppMessageAutoPresenter />`.

All types (`GalvaConfig`, `GalvaUserAttributes`, `GalvaLogEntry`,
`GalvaInAppMessage`, `GalvaError`, …) are exported from the package root. See
[`docs/`](./docs) for more.

## TypeScript

The whole surface is strict and fully typed. Two opt-in conveniences:

**Type your custom user attributes.** `GalvaUserAttributes` is an open interface —
augment it once to get autocomplete and type-checking on your own traits (values
must be scalars):

```ts
// galva.d.ts — anywhere in your project
declare module '@galva/react-native' {
  interface GalvaUserAttributes {
    planTier?: 'free' | 'pro';
    referralCount?: number;
  }
}
```

```ts
setUserAttribute('planTier', 'pro'); // ✅ autocompleted; 'gold' is a type error
setUserAttribute('referralCount', 3); // ✅ number enforced
```

**Namespaced calls.** Prefer `Galva.trackEvent(…)`? A namespace import works and
stays tree-shakeable — no separate "client" object:

```ts
import * as Galva from '@galva/react-native';

Galva.configureSDK({ apiKey: 'gv_pub_xxx' });
Galva.trackEvent('paywall_viewed');
```

## Native SDKs

This package wraps Galva's native SDKs. For native (Swift/Kotlin) integration, or
to understand what runs under the bridge:

- **iOS** — [Galva-io/galva-ios](https://github.com/Galva-io/galva-ios)
- **Android** — [Galva-io/galva-android](https://github.com/Galva-io/galva-android)

## Troubleshooting

- **`The package '@galva/react-native' doesn't seem to be linked`** — run
  `pod install` (bare) or rebuild your dev client; ensure you're **not** in Expo
  Go.
- **iOS build fails on `fmt` / clang** — you need **Xcode 26+**, and a React
  Native version that supports it (`0.86+` recommended). See
  [`docs/ios-build.md`](./docs/ios-build.md).
- **Deep links don't open the app** — confirm the `gv…` scheme is registered
  (Expo `deepLinkScheme`, or bare `Info.plist`/`AndroidManifest.xml`).

## License

MIT © Galva
