# @galva/react-native

React Native SDK for [Galva](https://galva.io) — the subscription retention platform.

> **Status:** in active development. Public API may change before `1.0`.

A thin, fully-typed React Native layer over the native Galva SDKs. iOS wraps the
first-party Swift core (vendored into the pod); Android integration is coming.

## Highlights

- **TypeScript-first**, strict, fully typed.
- **Old + New Architecture** — works across React Native `0.70`+ (the native
  module runs on the New Architecture via the interop layer).
- **Non-blocking** — every call is fire-and-forget or promise-based; nothing
  blocks the JS thread.
- **Zero-setup tracking** — deep links are observed through React Native's
  `Linking` API; once your app enables push, the APNs token + notification taps
  are captured automatically on iOS. The Expo plugin registers your Galva URL
  scheme too. (Setting up push capability itself is yours to do — see below.)
- **Bare and Expo** — ships an Expo config plugin so managed apps need no
  native edits.

## Install

```sh
npm install @galva/react-native
```

Then, on iOS:

```sh
cd ios && pod install
```

## Quick start

```tsx
import { Galva } from '@galva/react-native';

export default function App() {
  return (
    <Galva apiKey="gv_pub_xxx">
      <YourApp />
    </Galva>
  );
}
```

See [`docs/`](./docs) for the full API, and [`docs/expo.md`](./docs/expo.md) for
Expo setup (Galva needs a **dev build** — it doesn't run in Expo Go).

## Deep links

Galva assigns your app a **deep-link URL scheme** (it begins with `gv`, e.g.
`gvabc123` — copy it from your Galva dashboard). Once the scheme is registered
with the OS, the SDK claims matching links automatically — `configureSDK`
forwards them through React Native's `Linking` API, so there are no AppDelegate
or scene edits.

**Expo** — pass the scheme to the config plugin in `app.json`; it wires up iOS
`CFBundleURLTypes` and the Android launcher `intent-filter` for you:

```json
{
  "expo": {
    "plugins": [
      ["@galva/react-native", { "deepLinkScheme": "gvabc123" }]
    ]
  }
}
```

`deepLinkScheme` also accepts an array (`["gvabc123", "gvdef456"]`). The other
plugin prop is `swizzle` (default `true`) — set it `false` to opt out of iOS push
auto-wiring.

> **Push setup is yours.** Galva auto-wires the *observation* of push (APNs token
> + notification taps, via swizzling) but doesn't configure push capability. Add
> entitlements / `UIBackgroundModes` / the Android `POST_NOTIFICATIONS` permission
> and request authorization yourself — e.g. with
> [`expo-notifications`](https://docs.expo.dev/push-notifications/overview/).

**Bare React Native** — the plugin isn't read, so register the scheme yourself
(this is the standard iOS/Android URL-scheme setup):

- iOS — add to `ios/<App>/Info.plist`:

  ```xml
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLSchemes</key>
      <array><string>gvabc123</string></array>
    </dict>
  </array>
  ```

- Android — add an intent-filter to your launcher `<activity>` in
  `AndroidManifest.xml`:

  ```xml
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="gvabc123" />
  </intent-filter>
  ```

## License

MIT © Galva
