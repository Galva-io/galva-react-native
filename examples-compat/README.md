# Compatibility matrix apps

Standalone consumer apps verifying `@galva/react-native` across RN versions,
architectures, and Expo — the verified-by-hand matrix in
[`galva-rn-sdk-plan.md` §8](../galva-rn-sdk-plan.md).

**These are NOT npm workspaces** (deliberately): each app installs the library
from a fresh `npm pack` tarball, exactly like a real consumer — exercising the
published `files`/`exports` maps, the podspec, and autolinking. The day-to-day
development app (workspace-linked, CI-built) lives in [`../example`](../example).

| App | RN | Architecture | Verified (2026-06-11, from this committed state — Galva autolink asserted via Podfile.lock / PackageList.java) |
|---|---|---|---|
| `rn070-oldarch` | 0.70.15 (bare) | **Old** (Paper) | Android build ✅ + emulator runtime ✅ · iOS build (Xcode 26.5) ✅ + simulator runtime ✅ — the vendored core answers over the legacy bridge |
| `expo54-oldarch` | Expo SDK 54, `newArchEnabled: false` | **Old** | prebuild (config plugin) ✅ · Android build ✅ + emulator runtime ✅ · iOS build ✅ (needs the local `with-fmt-cxx17` plugin, see below) |
| `expo56-newarch` | Expo SDK 56 (default) | **New** (`fabric:true`, interop) | prebuild (config plugin) ✅ · Android build ✅ + emulator runtime ✅ · iOS build + simulator install ✅ (`npx expo run:ios`) |

(RN 0.85 / New Arch / bare is covered by `../example`. RN ≤ 0.6x is **not
buildable** on a 2026 toolchain at all — sources in plan §7 Phase 0.)

## Setup

```sh
./setup.sh                # all apps, or: ./setup.sh rn070-oldarch
```

Packs the library from the repo root and installs the tarball into each app
(`--no-save`). Re-run after changing library code.

## Running

### `rn070-oldarch` (bare RN 0.70, Old Architecture)

This app ships **pre-applied era patches** so it builds on a 2026 toolchain
(Xcode 26 / Node 22 / arm64) — each is a consumer-side workaround, not a
library issue (full story: plan §7 Phase 0):

- `patches/react-native+0.70.15.patch` (via `patch-package` on postinstall) — strips Yoga's `-Werror` (deprecated-literal-operator errors under new clang)
- `ios/Podfile` — platform bumped to 15.0; `__apply_Xcode_12_5_M1_post_install_workaround` removed (it forced every pod down to deployment target 11, breaking Swift availability); Flipper disabled (doesn't compile under Xcode 26)
- `ios/GalvaRN070/Empty.swift` + pbxproj — one empty Swift file in the ObjC-only app target so the Swift runtime/compat libs link (required by any Swift pod)
- `android/build.gradle` — minSdk 21 → 24 (Galva floor)

```sh
cd rn070-oldarch
(cd ios && pod install)
# Metro 0.72 crashes if watchman's state dir is root-owned — hide watchman:
env PATH="/usr/bin:/bin:/usr/sbin:/sbin:$(dirname "$(which node)")" npx react-native start
# then: build/run via Xcode (GalvaRN070.xcworkspace) or gradle :app:assembleDebug
```

### `expo54-oldarch` / `expo56-newarch` (CNG — `android/`/`ios/` are generated, gitignored)

```sh
cd expo54-oldarch          # or expo56-newarch
npx expo prebuild          # config plugin injects push entitlement/permission etc.
npx expo run:android       # or run:ios / build via the generated projects
```

`expo54-oldarch` pins `"newArchEnabled": false` in `app.json` (SDK 54 = the
last SDK supporting the opt-out); `expo56-newarch` runs the New Architecture
default. Expo Go is not supported (custom native code) — these are
dev-build/prebuild flows.

- `expo54-oldarch` ships a second, **local** config plugin
  (`plugins/with-fmt-cxx17.js`): Xcode 26.5's clang rejects the consteval usage
  in the fmt version RN 0.81 still compiles from source — the plugin forces the
  fmt pod to C++17 in the generated Podfile. Consumer-side era patch, not a
  Galva issue (fmt fails before the Galva pod compiles).
- ⚠️ Machine gotcha: a **global custom Xcode build location**
  (`IDEBuildLocationStyle = Custom` in Xcode → Settings → Locations) breaks
  Expo SDK 56 iOS builds (`ExpoModulesJSI`'s nested xcodebuild collides with
  the outer one → "Xcode build failed due to concurrent builds"). Switch
  Derived Data back to Default for these builds.
