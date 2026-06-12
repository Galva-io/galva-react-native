# Compatibility matrix apps

Standalone consumer apps verifying `@galva/react-native` across RN versions,
architectures, and Expo — the verified-by-hand matrix in
[`galva-rn-sdk-plan.md` §6](../galva-rn-sdk-plan.md).

**These are NOT npm workspaces** (deliberately): each app installs the library
from a fresh `npm pack` tarball, exactly like a real consumer — exercising the
published `files`/`exports` maps, the podspec, and autolinking. The day-to-day
development app (workspace-linked, CI-built) lives in [`../example`](../example).

| App | RN | Architecture | Verified (2026-06-11, from this committed state — build **and** dev-bundle runtime on BOTH platforms; Galva autolink asserted via Podfile.lock / PackageList.java) |
|---|---|---|---|
| `rn070-oldarch` | 0.70.15 (bare) | **Old** (Paper) | Android + iOS: build ✅, Metro dev-bundle runtime ✅ (emulator + simulator) — the vendored core answers over the legacy bridge (`sdkVersion: 1.0.0` on iOS) |
| `expo54-oldarch` | Expo SDK 54, `newArchEnabled: false` | **Old** ("Legacy Architecture" log) | prebuild (config plugin) ✅ · Android + iOS: build ✅, dev-bundle runtime ✅ (iOS needs the local `with-fmt-cxx17` plugin, see below) |
| `expo56-newarch` | Expo SDK 56 (default) | **New** (`fabric:true`, interop) | prebuild (config plugin) ✅ · Android + iOS: build ✅, dev-bundle runtime ✅ |

(RN 0.85 / New Arch / bare is covered by `../example`. RN ≤ 0.6x is **not
buildable** on a 2026 toolchain at all — sources in plan §6.)

## 0. One-time prerequisites

- **Xcode 26+** (the vendored Galva core is Swift 6 — plan §2), CocoaPods, JDK 17, Android SDK (an AVD with API ≥ 24; a debug RN APK is ~115 MB, so give the AVD an 8 GB data partition).
- ⚠️ **Xcode build location must be the DEFAULT.** A global custom location (Xcode → Settings → Locations → Derived Data: Custom) makes every xcodebuild share one folder — Expo SDK 56 iOS then fails with *"Xcode build failed due to concurrent builds"* (`ExpoModulesJSI`'s nested xcodebuild collides with the outer one), and parallel builds corrupt each other.
- ⚠️ **watchman + Node 22**: if watchman's state dir (`$TMPDIR/<user>-state`) is root-owned, Metro 0.72 (RN 0.70) crashes on start. Either fix the dir's ownership or run Metro with watchman hidden from `PATH` (commands below do this).

## 1. Setup (installs the library into each app)

```sh
cd examples-compat
./setup.sh                # all apps — or: ./setup.sh rn070-oldarch
```

What it does: `npm pack` the repo root → `.galva/galva-react-native.tgz` →
`npm install` in each app. The dependency entry in each `package.json` points
at that tarball (`file:../.galva/...`) — a real entry is **required** because
RN autolinking discovers native modules from `package.json`, not
`node_modules`. **Re-run after every library change.** (It also deletes each
app's `package-lock.json` — npm would otherwise reinstall the previous tarball
from cache, since the version doesn't change.)

## 2. `rn070-oldarch` (bare RN 0.70.15, Old Architecture)

Ships **pre-applied era patches** so it builds on a 2026 toolchain — each is a
consumer-side workaround, not a library issue (full story: plan §6):

- `patches/react-native+0.70.15.patch` (applied by `patch-package` on postinstall) — strips Yoga's `-Werror` (deprecated-literal-operator errors under new clang)
- `ios/Podfile` — platform 15.0; the `__apply_Xcode_12_5_M1_post_install_workaround` call removed (it forced every pod to deployment target 11, breaking Swift availability) while keeping its one useful piece as an explicit sed: the RCT-Folly `Time.h` clockid_t fix; Flipper disabled (doesn't compile under Xcode 26)
- `ios/GalvaRN070/Empty.swift` + pbxproj — one empty Swift file in the ObjC-only app target so the Swift runtime/compat libs link (required by any Swift static pod)
- `android/build.gradle` — minSdk 21 → 24 (Galva floor)

```sh
cd rn070-oldarch

# Terminal 1 — Metro (watchman hidden, see prerequisites):
env PATH="/usr/bin:/bin:/usr/sbin:/sbin:$(dirname "$(which node)")" npx react-native start

# Terminal 2 — Android (boot an emulator first):
(cd android && JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew :app:assembleDebug)
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb reverse tcp:8081 tcp:8081
adb shell am start -n com.galvarn070/.MainActivity

# Terminal 2 — iOS:
(cd ios && pod install)
xcodebuild -workspace ios/GalvaRN070.xcworkspace -scheme GalvaRN070 \
  -configuration Debug -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build
xcrun simctl boot "iPhone 16 Pro"   # any iOS 15+ simulator
xcrun simctl install "iPhone 16 Pro" <BUILT_PRODUCTS_DIR>/GalvaRN070.app
xcrun simctl launch "iPhone 16 Pro" org.reactjs.native.example.GalvaRN070
```

(`npx react-native run-android` / `run-ios` also work if you prefer the CLI
driver — they just wrap the steps above.)

**Expected:** the screen shows `RN 0.70 / Old Architecture`; on iOS
`sdkVersion: 1.0.0` (the real vendored core over the legacy bridge); on
Android `sdkVersion: 0.0.0-android-stub` plus one `Galva: …no-op` logcat line
per called method (the Android core is unreleased — stub by default).
`identifiedUserId: null/undefined`, `isAnonymous: true` right after launch are
expected (identify is eventually consistent — plan §4).

## 3. `expo54-oldarch` / `expo56-newarch` (CNG — `android/`/`ios/` are generated and gitignored)

```sh
cd expo54-oldarch              # or expo56-newarch

npx expo prebuild              # regenerates android/ + ios/; the Galva config
                               # plugin injects the push entitlement,
                               # UIBackgroundModes and POST_NOTIFICATIONS

# Android (boots/uses an emulator, starts Metro, installs & launches):
npx expo run:android

# iOS (builds with xcodebuild, installs & launches on a simulator):
npx expo run:ios
```

To run Metro separately (e.g. re-attach after the app is installed):
`npx expo start --port 8081`, then `adb reverse tcp:8081 tcp:8081` for the
emulator and relaunch the app.

**Expected:** `Expo SDK 54 / Old Architecture` (logcat also prints RN's *"The
app is running using the Legacy Architecture"* warning) or `Expo SDK 56 / New
Architecture` (`fabric:true` in the `Running "main"` logcat line). iOS shows
`sdkVersion: 1.0.0` (real core), Android the stub version, as above.

Notes:

- `expo54-oldarch` pins `"newArchEnabled": false` in `app.json` (SDK 54 = the
  last SDK supporting the opt-out); `expo56-newarch` runs the New Architecture
  default. Expo Go is not supported (custom native code) — these are
  dev-build/prebuild flows.
- `expo54-oldarch` ships a second, **local** config plugin
  (`plugins/with-fmt-cxx17.js`): Xcode 26.5's clang rejects the consteval usage
  in the fmt version RN 0.81 still compiles from source — the plugin forces the
  fmt pod to C++17 in the generated Podfile. Consumer-side era patch, not a
  Galva issue (fmt fails before the Galva pod compiles).

## 4. Android core toggle (dev-only)

By default these apps exercise the Android **stub** (plan §3.6). To run them
against the real (unreleased) Android core — verified 2026-06-12:

1. Publish the core to mavenLocal: clone galva-android, strip the leaked
   `signingInMemory*` props from `gradle.properties`, run
   `./gradlew publishToMavenLocal`.
2. Add the dev-only repo block to the **app's** `android/build.gradle`
   (Gradle resolves the app's classpath with the *app's* repositories — the
   library's own `mavenLocal()` block never reaches that resolution; for the
   Expo apps the file is prebuild-generated, so re-add it after every
   `npx expo prebuild`):

   ```gradle
   if ((findProperty("Galva_androidCore") ?: "false").toString().toBoolean()) {
     allprojects { repositories { mavenLocal() } }
   }
   ```
3. Build with the flag and install/run as in the sections above:
   `(cd android && ./gradlew :app:assembleDebug -PGalva_androidCore=true)`.

**Expected:** Android shows `sdkVersion: 1.0.0-SNAPSHOT` (the real core) and
logcat has **zero** `Galva: …no-op` stub lines.

| App | Core-toggle result |
|---|---|
| `expo54-oldarch` | ✅ build + Metro dev-bundle runtime on emulator |
| `expo56-newarch` | ✅ build + Metro dev-bundle runtime on emulator |
| `rn070-oldarch` | ❌ **infeasible on the RN 0.70-era toolchain** — three independent blockers from the core AAR itself: it demands **compileSdk 36** (era AAPT2 ≤ AGP 7.4 can't even parse android-36's `android.jar`), ships **Java-17 bytecode** (AGP 7.2.1's D8 can't dex it; 7.4.2 can), and carries **Kotlin 2.2 metadata** (Kotlin 2.0.x throws an internal compiler error; KGP ≥ 2.1 needs Gradle ≥ 7.6.3). Every fix escalates to AGP 8 / Gradle 8 / Kotlin 2.1 — at which point it is no longer an RN 0.70-era app. The stub remains the RN ≤ 0.70 Android story (plan §3.6). |
