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
- **Zero-setup linking & push** — deep links are observed through React
  Native's `Linking` API; APNs token + notification taps are captured
  automatically on iOS.
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

See [`docs/`](./docs) for the full API, Expo setup, and push notifications.

## License

MIT © Galva
