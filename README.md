# @galva/react-native

React Native SDK for [Galva](https://galva.io) — subscription retention platform.

One package for both architectures: the SDK uses the legacy native bridge (no codegen), so it runs on the Old Architecture and on the New Architecture via RN's interop layer, with no React Native version floor declared.

## Installation

```sh
npm install @galva/react-native
cd ios && pod install
```

No other native setup: the iOS pod autolinks and links statically (no `use_frameworks!`, no Podfile edit). The first-party Galva iOS core is vendored in the package and compiled inside the pod — see [`galva-rn-sdk-plan.md`](galva-rn-sdk-plan.md) §3.2.

### Requirements

| | |
|---|---|
| React Native | no declared floor — verified on **0.85 (New Arch)** and **0.70 (Old Arch)**; RN ≤ 0.70 needs era-specific consumer patches (Flipper off, an empty `.swift` file in ObjC-only apps, …— see [plan §6](galva-rn-sdk-plan.md)); RN ≤ 0.6x is not buildable on 2026 toolchains at all |
| iOS | deployment target ≥ 15.0, **Xcode 26+** (the core is Swift 6 and uses an iOS 26 SDK symbol) |
| Android | minSdk 24 — **stub by default**: the Galva Android core is unreleased (`1.0.0-SNAPSHOT`), so calls no-op/reject. Real core wiring exists behind the `Galva_androidCore=true` Gradle property (dev-only, needs the core on mavenLocal **and a modern Android toolchain** — the core AAR demands compileSdk 36 / Java-17-capable D8 / Kotlin ≥ 2.1, so it can't ride RN ≤ 0.70-era builds) and becomes the default when `io.galva.sdk:galva-sdk:1.0.0` ships ([plan §3.6](galva-rn-sdk-plan.md)) |
| Expo | supported via a **development build** (`expo-dev-client`); Expo Go is not supported (custom native code). Add the config plugin: `"plugins": ["@galva/react-native"]` in `app.json` — injects the push entitlement + `UIBackgroundModes` (iOS) and `POST_NOTIFICATIONS` (Android); pass `{ "push": false }` to opt out |

## Usage

Wrap your app in `<Galva>` (configures the SDK once) and drop in
`<InAppMessageAutoShow />` to render any message the backend serves — that's the
whole integration:

```tsx
import { Galva, InAppMessageAutoShow } from '@galva/react-native';

export default function App() {
  return (
    <Galva apiKey="gv_pub_xxx">
      <YourApp />
      <InAppMessageAutoShow />
    </Galva>
  );
}
```

Then call the flat functions anywhere — they're fire-and-forget (return
synchronously; the native core queues, persists to SQLite, and uploads in the
background with retry, so events survive crashes and offline periods):

```ts
import { identify, track } from '@galva/react-native';

identify('user_42', { appAccountToken: '8e0f7c2a-…' }); // token links StoreKit purchases
track('AddHabitButtonTapped');
track('Purchase', { sku: 'pro_yearly', price: 9.99 });
```

Read identity reactively with the `useGalvaUser()` hook, and take manual control
of message presentation (filtering, custom UI) with `useInAppMessages()`:

```tsx
import { useGalvaUser, useInAppMessages, show } from '@galva/react-native';

function Profile() {
  const { userId, isAnonymous, loading } = useGalvaUser();
  useInAppMessages((message) => {
    if (message.workflowType !== 'trial-rescue') show(message.id); // your rule
  });
  // …
}
```

### API

Flat named exports, one per function (tree-shakeable, lodash-es style):

- **Setup / global** — `configure`, `setOptOut`, `isOptedOut`, `setDeviceToken`, `reconcileTransactions`, `sdkVersion`
- **Events** — `track`
- **User** — `identify`, `logout`, `identifiedUserId`, `isAnonymous`, `setEmail`, `setDisplayName`, `setUserProperty`, `setUserProperties` (bulk)
- **Communication endpoints** — `registerEmail`, `unregisterEmail`, `registerPushToken`, `unregisterPushToken`, `setCommunicationPreference`, `isValidEmail`
- **In-app messages** — `onMessage` (emitter; returns an `unsubscribe` function), `show`, `checkForMessages`

Plus a React-first layer over the same surface:

- **Components** — `<Galva>` (provider; configures on mount), `<InAppMessageAutoShow>` (auto-renders served messages; optional `filter` prop)
- **Hooks** — `useGalvaUser()` (reactive identity: `{ userId, isAnonymous, loading, refresh }`), `useInAppMessages(handler)` (subscribe for a component's lifetime)

Each export carries full TSDoc; types (`GalvaConfig`, `InAppMessage`, …) are exported from the package root.

## Guides

- [Push notifications](docs/push-notifications.md) — APNs/FCM token flow, `setDeviceToken` vs `registerPushToken`, preferences
- [Expo](docs/expo.md) — dev-build setup, config-plugin injections & options, EAS
- [Older React Native](docs/legacy-react-native.md) — supported range, the RN 0.70 patch list, why ≤ 0.6x can't work

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow) — the dev app lives in [`example/`](example); the RN-0.70/Expo old-&-new-arch compatibility apps live in [`examples-compat/`](examples-compat/README.md)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [Architecture & build plan](galva-rn-sdk-plan.md)

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
