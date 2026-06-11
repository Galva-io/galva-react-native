# @galva/react-native

React Native SDK for [Galva](https://galva.io) — subscription retention platform.

One package for both architectures: the SDK uses the legacy native bridge (no codegen), so it runs on the Old Architecture and on the New Architecture via RN's interop layer, with no React Native version floor declared.

## Installation

```sh
npm install @galva/react-native
cd ios && pod install
```

No other native setup: the iOS pod autolinks and links statically (no `use_frameworks!`, no Podfile edit). The first-party Galva iOS core is vendored in the package and compiled inside the pod — see [`galva-rn-sdk-plan.md`](galva-rn-sdk-plan.md) §3.4.

### Requirements

| | |
|---|---|
| React Native | no declared floor — verified on **0.85 (New Arch)** and **0.70 (Old Arch)**; RN ≤ 0.70 needs era-specific consumer patches (Flipper off, an empty `.swift` file in ObjC-only apps, …— see [plan §7 Phase 0](galva-rn-sdk-plan.md)); RN ≤ 0.6x is not buildable on 2026 toolchains at all |
| iOS | deployment target ≥ 15.0, **Xcode 26+** (the core is Swift 6 and uses an iOS 26 SDK symbol) |
| Android | minSdk 24 — **stub by default**: the Galva Android core is unreleased (`1.0.0-SNAPSHOT`), so calls no-op/reject. Real core wiring exists behind the `Galva_androidCore=true` Gradle property (dev-only, needs the core on mavenLocal) and becomes the default when `io.galva.sdk:galva-sdk:1.0.0` ships ([plan §3.7](galva-rn-sdk-plan.md)) |
| Expo | supported via a **development build** (`expo-dev-client`); Expo Go is not supported (custom native code). Add the config plugin: `"plugins": ["@galva/react-native"]` in `app.json` — injects the push entitlement + `UIBackgroundModes` (iOS) and `POST_NOTIFICATIONS` (Android); pass `{ "push": false }` to opt out |

## Usage

```ts
import {
  configure,
  identify,
  track,
  messages,
  show,
} from '@galva/react-native';

// Once, at app launch:
configure({ apiKey: 'gv_pub_xxx' });

// Identity
identify('user_42', { appAccountToken: '8e0f7c2a-…' }); // token links StoreKit purchases
track('AddHabitButtonTapped');
track('Purchase', { sku: 'pro_yearly', price: 9.99 });

// In-app messages: subscribe, then render by id
const unsubscribe = messages((message) => {
  show(message.id); // SDK presents a managed WebView sheet
});
// later
unsubscribe();
```

All write APIs are fire-and-forget: they return synchronously and the native core queues, persists (SQLite), and uploads in the background with retry — events survive crashes and offline periods.

### API

Flat named exports, one per function (tree-shakeable, lodash-es style):

- **Setup / global** — `configure`, `setOptOut`, `isOptedOut`, `setDeviceToken`, `reconcileTransactions`, `sdkVersion`
- **Events** — `track`
- **User** — `identify`, `logout`, `identifiedUserId`, `isAnonymous`, `setEmail`, `setDisplayName`, `setUserProperty`
- **Communication endpoints** — `registerEmail`, `unregisterEmail`, `registerPushToken`, `unregisterPushToken`, `setCommunicationPreference`, `isValidEmail`
- **In-app messages** — `messages` (emitter; returns an `unsubscribe` function), `show`, `checkForMessages`

Each export carries full TSDoc; types (`GalvaConfig`, `InAppMessage`, …) are exported from the package root.

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow) — the dev app lives in [`example/`](example); the RN-0.70/Expo old-&-new-arch compatibility apps live in [`examples-compat/`](examples-compat/README.md)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [Architecture & build plan](galva-rn-sdk-plan.md)

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
