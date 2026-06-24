# Expo integration

Galva ships an [Expo config plugin](../README.md#deep-links) so managed apps need
no manual native edits — add `@galva/react-native` to `plugins` in `app.json` and
`expo prebuild` wires up the deep-link scheme (and the swizzle opt-out flag) for
you.

## Requires a dev build (not Expo Go)

Galva includes a native module (the vendored Swift core), so it **can't run in
Expo Go** — Expo Go only bundles Expo SDK's own native code. Use a **dev build**:
run `npx expo prebuild` (bare/CNG workflow) or build a
[development build](https://docs.expo.dev/develop/development-builds/introduction/)
with EAS. Everything else (the plugin, deep links, push observation) works
normally from there.

## End-to-end tests

Two layers prove the integration works in a real Expo app — not just unit tests
on the plugin's transforms. Both live under [`e2e/expo`](../e2e/expo) (a committed
fixture app) and are driven by scripts:

| Layer | Command | What it proves | Cost / CI |
|-------|---------|----------------|-----------|
| **L1** | `npm run test:expo:prebuild` | The plugin works in a **real `expo prebuild`**: the `gv…` deep-link scheme is registered on iOS **and** Android, the app's own scheme is preserved (coexistence), and **no push config** is injected. Read back through Expo's own readers (`IOSConfig.Scheme` / `AndroidConfig.Manifest`). | Deterministic, device-free. **Every PR.** |
| **L2** | `npm run test:expo:runtime` | The SDK is **compatible with an Expo native build**, and the plugin-registered scheme **routes a `gv://` URL to the app at runtime** on a simulator (plus a screenshot artifact). | Full native build (Xcode 26). **Nightly + manual.** |

Both pack the SDK with `npm pack` and install it into the fixture exactly as a
consumer would (`"@galva/react-native": "file:./galva.tgz"`), so they exercise the
real published surface (podspec, `app.plugin.js`, `plugin/build`).

### Toolchain note

The fixture tracks the latest Expo SDK (56), which pins **React Native 0.85.3**.
The L2 native build therefore needs **Xcode 26 specifically**:

- **Use stable Xcode 26, not Xcode 27 beta.** Expo SDK 56's own `expo-modules-jsi`
  fails to compile under Xcode 27's Swift (`a C function pointer can only be
  formed from a reference to a 'func' or a literal closure`) — an Expo/Swift issue
  unrelated to Galva. `scripts/test-expo-runtime.sh` and CI both select Xcode 26.
- If it fails on `fmt` consteval under clang 21, apply the C++17 workaround in
  [ios-build.md](./ios-build.md) (RN 0.86+ ships `fmt` prebuilt; RN 0.85.3 builds
  it from source).

Galva's own core/bridge compile cleanly on Xcode 26 — the L2 run confirms it
inside a real Expo project. L1 has no native compile and is unaffected (it runs
on any OS, every PR).

## Push setup is yours

The plugin deliberately does **not** configure push capability (no
`aps-environment`, `UIBackgroundModes`, or `POST_NOTIFICATIONS`). Galva only
auto-wires the *observation* of push (APNs token + notification taps, via
swizzling — opt out with the plugin's `swizzle: false`). Set up push capability
and request authorization yourself, e.g. with
[`expo-notifications`](https://docs.expo.dev/push-notifications/overview/).
