# iOS build & toolchain

## Xcode 26+ is required

The Galva iOS core (vendored into the pod) compiles against an **iOS 26 SDK**
symbol (a back-deployed StoreKit 2 promotional-offer API), so the app embedding
`@galva/react-native` must build with **Xcode 26 or newer**. The symbol is
back-deployed, so your app's deployment target can stay at **iOS 15**.

## React Native version + Xcode 26 (`fmt` consteval) — older RN only

Because the Galva core needs Xcode 26 (clang 21), use a React Native version
that supports that toolchain. **RN 0.86+ is recommended** — it ships prebuilt
dependencies (`ReactNativeDependencies`), so `fmt` is consumed as a binary and
never compiled from source. The bundled `example/` app is on RN 0.86 and builds
cleanly with **no workaround**.

RN versions that build `fmt` 11 **from source** (≈0.81–0.85) fail under clang 21:

```
error: call to consteval function 'fmt::basic_format_string<…>' is not a constant expression
```

This is a React Native toolchain issue, not a Galva one. If you must stay on
such a version, compile just the `fmt` pod as C++17 (its `consteval` path is
C++20-only, so it's skipped) in your `Podfile` `post_install`:

```ruby
installer.pods_project.targets.each do |t|
  next unless t.name == 'fmt'
  t.build_configurations.each do |c|
    c.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
  end
end
```

See [facebook/react-native#55601](https://github.com/facebook/react-native/issues/55601).

## Push auto-wiring: how the swizzler is proven safe

Auto-wiring swizzles two host delegate methods (`ios/autowire/GalvaAutoWire.m`),
which is inherently risky — get it wrong and you drop another SDK's callback or
call a notification completion handler twice. Two complementary test layers prove
it's safe, both run in CI:

| Layer | Command | What it proves | How |
|-------|---------|----------------|-----|
| **Unit** | `npm run test:ios` | The swizzle *logic* — chaining, add-vs-wrap, completion-handler-exactly-once, idempotency, opt-out (enabled **and** disabled), inheritance safety. | A standalone XCTest **logic bundle** (no Pods/core/React) over synthetic runtime classes + a recording stub. Fully deterministic. `ios/autowire/__tests__`. |
| **E2E** | `npm run test:ios:e2e` | The *real* world — the `+load → didFinishLaunching` install runs against the **real** app & UN delegates; coexistence with a **live** OneSignal-style competitor swizzler in **both** load orders; completion-once with a real `UNNotificationResponse`. | An **app-hosted** XCTest inside the real example app, against the real Galva pod. `example/ios/GalvaExampleTests`. |

The split is deliberate: the opt-out *disabled* path can't be flipped mid-process
(the gate reads `Info.plist` at launch), so it's proven deterministically by the
unit layer; the E2E proves the default-on path in a real app. Whether Galva's own
forward actually ran in the E2E is observed via a `#if DEBUG`-only notification
posted by `GalvaAutoWire.swift` (compiled out of release builds entirely).

The E2E target is added to the example project by `scripts/gen-e2e-target.rb`
(idempotent) and committed; `scripts/test-autowire-e2e.sh` does pod install +
`xcodebuild test`. Both need Xcode 26+ and a simulator.

## Notes

- The vendored core is committed under `ios/galva-src/` (pinned via
  `galva.lock.json`); CI needs no extra checkout to build it.
- Push auto-wiring (swizzling) is on by default. Opt out with the Expo plugin
  prop `swizzle: false`, or set `GalvaSwizzlingEnabled = NO` in your Info.plist.
- Deep links: pass your Galva `gv…` scheme as the Expo plugin prop
  `deepLinkScheme` and it's added to `CFBundleURLTypes` for you; bare apps add it
  to `Info.plist` manually. See the README "Deep links" section.
