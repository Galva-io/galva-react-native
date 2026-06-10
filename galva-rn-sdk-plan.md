# `@galva/react-native` (RN RevFlow) — Build Plan

> Status: **DRAFT for review** · Date: 2026-06-04 · Owner: thaitd
> Goal: wrap the Galva Client SDK for React Native, **support both old & new projects**, **lowest possible RN footprint**.

---

## 0. TL;DR (read this first)

- **One single package** `@galva/react-native` covering both Old Arch and New Arch — **do not split into 2 packages**.
- Author native via **legacy `RCTBridgeModule` + `NativeEventEmitter` + TurboModule interop** → most primitive API, **no RN floor declared**, still runs on New Arch.
- iOS core (`Galva-io/galva-ios`) is **first-party (our own repo), SPM-only, Swift 6, public**, **requires Xcode 26 to build**, **no CocoaPods**; **tagged per release** (none yet → fall back to `main`).
- **iOS distribution = B (compile source in the pod) — PRIMARY (decision 2026-06-04).** We **vendor Galva's Swift source** into the package and let **CocoaPods compile it** (`s.source_files`). CocoaPods' **default linkage is static** → links into the app with **no `use_frameworks!`**, **Do Not Embed**, **zero Podfile edit**. No prebuilt binary, no xcframework build.
- **A2 (ship a prebuilt static `Galva.xcframework`) is demoted to a future optimization** (§3.7), kept with full analysis. We switch to it only if a concrete trigger appears (Galva cuts a binary release, or consumer build-time / Xcode floor becomes a real pain).

### Why B, not A2 (decision record — 2026-06-04)
We initially chose A2 (ship binary). Two findings flipped it:

1. **`galva-ios` is first-party** — it is **our own repo**, not a third-party SDK. So the entire license / IP-exposure / "source not redistributable" concern that originally pushed us to A2 **never applied**: we own the source, we can vendor and ship it freely.
2. **The codebase is small** — **45 Swift files / ~10,362 LOC**. Compiling it is **tens of seconds clean, ~0 incremental** — not a Firebase-scale burden.

With those two gone, the comparison collapses:

- **A2's build is genuinely tricky.** Producing a *static* `.framework` from this package is awkward: archiving the static `Galva` product yields only a `.o` (Galva's own script comment), so you must archive the `Galva_dynamic` scheme and **override `MACH_O_TYPE=staticlib`** (fighting the declared `.dynamic` product type) — plus strip their dylib `install_name` patching — **or** build a separate **wrapper Framework target**. On top: multi-slice assembly, a CI Xcode-26 binary pipeline, provenance stamping, and the `-no-verify-emitted-module-interface` workaround (the module name `Galva` collides with the public type `Galva`, breaking the `.swiftinterface` verifier).
- **A2's headline advantage is mostly illusory.** Its selling point was "free the consumer from Xcode 26". But our bridge **always compiles consumer-side** and does `import Galva` → the consumer's compiler must **parse Galva's Swift-6 `.swiftinterface`**, needing a toolchain **≈ Xcode 26** (which bundles the iOS 26 SDK anyway). → **The practical consumer Xcode floor is ~26 in BOTH paths.** A2 carries a fragile build to buy an advantage that barely exists.
- **B sidesteps all of it.** CocoaPods compiles `s.source_files` **static by default** → zero `use_frameworks!`, zero Podfile edit, **no swiftinterface/ABI concerns**, **no `-no-verify-emitted-module-interface`** (we never emit a distributable interface), no binary pipeline. The manifest is trivial (audited: `dependencies: []`, only `sqlite3`, no `resources`) → `Package.swift`→podspec drift surface is tiny.

> **Net:** B trades a *small* consumer build cost (tens of seconds) for the **elimination of a fragile binary-build pipeline**. And the one real cost B carries — **consumer needs Xcode 26** — is a cost **A2 could not actually avoid** either. So B is simpler *and* roughly Xcode-equivalent. → **B wins.**

### Locked decisions (2026-06-04)
- **No RN floor declared** — the lib uses **the most primitive API possible** (legacy `NativeModules` + `NativeEventEmitter`, no codegen/TurboModule spec) → version-agnostic. No floor in code, podspec, or metadata.
- **`peerDependencies: "react-native": "*"`** — the lib runs as far back as it runs; any RN without autolinking → **the consumer links manually**. Trade-off: no peer-mismatch warning for very old RN (accepted).
- **B (compile source) is the shipped iOS path.** Vendor Galva's `.swift` (our own first-party code) → CocoaPods compiles it static → zero Podfile edit. No license/IP constraint — we own `galva-ios`.
- **Consumer Xcode = 26+ — ACCEPTED, not dodged** (incl. the old RN project — *assumed accepted*). This is in sync with the native core (galva-ios needs Xcode 26). It is **not** a risk we engineer around anymore; A2 was the only lever to dodge it and that lever is both unproven and tricky.
- **Vendor source pinned BY TAG** (galva-ios tags each release); fall back to `main` only while no tag exists. Recorded in `galva.lock.json` (`ref` + resolved `commit`). Public repo → CI clones anonymously, **no auth**.
- **Android core EXISTS but is UNRELEASED** (`Galva-io/galva-android` @ `identity-module` = full multi-module Gradle SDK, `1.0.0-SNAPSHOT`, coordinate unsettled). Android = **consume the Maven AAR** (`implementation`), **not** vendor source — the mirror-image of iOS (§3.9). iOS-first initially; Android **stub until `1.0.0` ships**. ⚠️ Its public repo also leaks live publishing secrets — rotate before any release (§3.9).
- **Expo = first-class via dev build** (§3.8): autolinked legacy bridge + an `app.plugin.js` config plugin. **Expo Go not supported** (custom native → dev build / prebuild / EAS required — normal for any native lib). **No** rewrite to an Expo Module; **no** `expo` peerDep → bare RN untouched. EAS Xcode-26 worry **verified a non-issue** — EAS's default image is already Xcode 26.4 (§3.8).

**Open questions:** none blocking — see §10.

---

## 1. Context & scope

Galva = subscription **retention** platform. The Client SDK is intentionally thin, 5 responsibilities:
1. Identity mapping (anonymous ↔ identified user)
2. In-app message display
3. Offer redemption prompt
4. Push token + consent management
5. Session tracking

**Billing:** Galva *does* orchestrate purchases internally (native `BillingManager` / `:billing` module on Android + the IAM `requestPurchase` bridge — §3.9), but the actual purchase always executes via the platform's native **StoreKit 2 / BillingClient**. On **iOS** no billing API is surfaced to JS (the host owns its purchase flow). On **Android** the core exposes `BillingManager`, so billing **is** surfaced to JS as an **Android-only** API (`@platform android` — §6.2). (Earlier drafts said "no billing logic" — imprecise: the SDK has billing logic; what was meant is "no billing API on iOS.")

Two consumers we must serve:
- **New project** = `habitify-rn` — **RN 0.85.3 / React 19.2.3**, New Arch default, iOS ~15.1 / Android API ~24.
- **Old project** = *(RN version TBD)* — **assumed to accept Xcode 26**.

Both bare-RN and **Expo** consumers are in scope. Expo is served via a **development build** (not Expo Go) plus a config plugin — see §3.8.

---

## 2. Ground truth: repo `Galva-io/galva-ios`

| Aspect | Fact (verified 2026-06-04) |
|---|---|
| Ownership | **First-party — our own repo.** No license/IP constraint on vendoring or shipping the source |
| Visibility | **Public** — `git ls-remote` succeeds anonymously → CI needs **no token/auth** |
| Distribution | **SPM-only**, `swift-tools-version: 6.0`, `platforms: [.iOS(.v15), .macOS(.v12)]` |
| Size | **45 Swift files, ~10,362 LOC** → cheap to compile (tens of seconds clean) |
| Target | `.target(name: "Galva", path: "Sources", linkerSettings: [.linkedLibrary("sqlite3")])` — **`dependencies: []`**, **no `resources:`**, no `swiftSettings` |
| Products | **`Galva` (static, default for SPM source consumers)** + `Galva_dynamic` (`type: .dynamic`, by its own comment "used ONLY by `scripts/build-xcframework.sh`" → their prebuilt release is **dynamic**) |
| Tags / releases | **Tagged per release** going forward; **none yet** → fall back to `main`. We vendor **by tag** (→ resolved commit in lock) |
| CocoaPods | **"Not supported"** — no podspec → **we author our own** |
| Build | **Xcode 26+** (StoreKit offer uses `promotionalOffer(_:compactJWS:)` — an iOS 26 SDK symbol, `@backDeployed` to iOS 15 runtime) |
| React Native | **Not mentioned at all** |

**Consequences:**
- We embed the iOS core via **CocoaPods** → author our own podspec that **compiles the vendored source** (mode B).
- First-party + public + small + trivial manifest → **source distribution is the natural, supported path** (Galva's `Galva` product is literally "the default for SPM source consumers").

> **Android:** the native core **exists** (`Galva-io/galva-android` @ `identity-module` — a complete multi-module Gradle SDK) but is **not released** (`1.0.0-SNAPSHOT`, coordinate unsettled). Android wrapper **depends on the Maven AAR** (no vendoring) — stub/mock first, flip to `implementation("io.galva…:…:1.0.0")` when it ships. Full analysis in **§3.9**.

---

## 3. Architecture decisions (and why)

### 3.1 One package, no old/new split
The legacy bridge + interop strategy makes **one codebase run on both Old and New Arch** — RN's interop layer wraps the legacy `RCTBridgeModule` into a TurboModule when New Arch is on. Old/new differences are just a few **build-config knobs**, handled with `if` in a single podspec/gradle:

| Difference | Handling |
|---|---|
| New Arch flag (`RCT_NEW_ARCH_ENABLED`) | Interop handles it |
| Codegen versioning | **No codegen** → no issue |
| `install_modules_dependencies` (RN ≥0.71) | Podspec `if respond_to?(...)` manual fallback |
| New Arch Gradle (`isNewArchitectureEnabled`) | Conditional sources via `gradle.properties` |
| `NativeEventEmitter` warning on iOS | Guard constructor-arg per platform |

Precedent: reanimated / svg / gesture-handler are all **one package** + `peerDependencies` range + internal conditionals.

### 3.2 Authoring: legacy bridge, NO codegen TurboModule
- `@objc(Galva)` Swift module + a `.m` file with `RCT_EXTERN_MODULE` / `RCT_EXTERN_METHOD`.
- Events via `RCTEventEmitter` (native) ↔ `NativeEventEmitter` (JS).
- Why: codegen event-emitter needs RN ≥0.73 → conflicts with "lowest RN". Legacy is version-agnostic, works far back yet still reaches New Arch via interop.

### 3.3 Min deployment & Xcode floor
- iOS 15 / API 24 is the **OS floor** (also a StoreKit 2 requirement) — it does **not** reduce the RN version range (an app can always raise its target).
- **Xcode 26 is the consumer floor — accepted.** The pod compiles Galva's Swift-6 source, which references an iOS-26 SDK symbol (`compactJWS`) → the consumer's toolchain must be Xcode 26 (which bundles the iOS 26 SDK). This is **in sync with the native core** and is **not** something we engineer around (see the §0 decision record — A2 was the only dodge and it's both unproven and tricky).

### 3.4 iOS distribution: B — compile vendored source in the pod (PRIMARY)
We vendor Galva's Swift source into the package and let **CocoaPods compile it** alongside our bridge. Because CocoaPods' **default linkage is static**, the compiled core links straight into the app — **no `use_frameworks!`, Do Not Embed, zero Podfile edit**.

```ruby
require 'json'
pkg  = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))   # podspec in ios/ → '..' to root

Pod::Spec.new do |s|
  s.name          = 'galva-react-native'
  s.version       = pkg['version']
  s.platforms     = { :ios => '15.0' }
  s.source        = { :git => 'https://github.com/<org>/galva-react-native.git', :tag => s.version.to_s }
  s.swift_version = '6.0'                       # Galva uses Swift 6 strict concurrency

  # Our bridge + the vendored Galva core — all compiled by the consumer (static by default).
  s.source_files = 'bridge/**/*.{h,m,mm,swift}', 'galva-src/Sources/**/*.swift'
  s.libraries    = 'sqlite3'                    # Galva links sqlite3 (Package.swift linkerSettings)
  s.frameworks   = 'StoreKit', 'WebKit'

  # RN ≥0.71 helper, fallback for older RN
  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency 'React-Core'
  end
end
```

**Why this is clean (vs the A2 binary path):**
- **Static by default** → no `use_frameworks!`, no embed, no Podfile edit. (A static *binary* would also achieve this, but only after a tricky static-xcframework build — see §3.7.)
- **No swiftinterface / module-stability / ABI** — the core is compiled fresh in the same pod build; we never emit a distributable `.swiftinterface`, so the **`Galva`-module-vs-`Galva`-type collision never bites** (no verifier step).
- **Trivial manifest mapping** — audited: `dependencies: []`, only `sqlite3`, no `resources`. The single podspec line `s.libraries = 'sqlite3'` reproduces `Package.swift`'s `linkerSettings`.
- **Autolinked** — default RN Podfile already runs `use_native_modules!` → the consumer adds no `pod` line. Their only step is the ordinary `cd ios && pod install`.

> **Consumer cost (accepted):** a clean build compiles ~10k LOC of Swift 6 (tens of seconds) and needs **Xcode 26**. Both are accepted (§3.3). Incremental builds are unaffected.

### 3.4.1 Vendoring & syncing the core source (the sync solution)

**Repo ground truth (probed + validated 2026-06-04):**
- Public (anonymous clone, **no auth**); layout `Sources/`, `Tests/`, `LICENSE`, `Package.swift`.
- **Tagged per release going forward** → vendor **by tag** (preferred); **fall back to `main`** when no tag exists yet (current state). The lock records the `ref` (tag/main) **and** the resolved `commit`. **Validated:** `git fetch --depth 1 origin <tag|branch|sha>` works on GitHub anonymously — tags, `main`, and reachable commit SHAs all fetch shallowly.
- **`Sources/` is self-contained — validated:** every `import` is a **system framework** (`Foundation`, `StoreKit`, `UIKit`, `WebKit`, `SwiftUI`, `UserNotifications`, `os`, plus cross-platform `AppKit`/`WatchKit` behind `#if os(...)`) **+ `SQLite3`** (the *system* libsqlite3 module — **not** the third-party SQLite.swift). → **0 transitive Swift deps to vendor**; the podspec needs only `s.libraries = 'sqlite3'`. No non-`.swift` resources under `Sources/`.
- ⚠️ Phase 1 check: the cross-platform `AppKit`/`WatchKit` files must be `#if os(...)`-guarded so they compile to nothing on an iOS pod target (expected, since Galva builds for iOS — verify once).

**Constraints that decide the approach:**
1. **npm does not check out git submodules** → a submodule pointer is **empty** in the consumer's `node_modules` → `pod install` sees no `.swift` → fails.
2. CocoaPods needs **physical `.swift` files** at `source_files` at the consumer's build time.

→ The core source must be **real, committed files, listed in `files`** = **vendored** (a real copy), pinned and drift-detectable.

`scripts/sync-galva.sh [<ref>]` — **tag-first, main-fallback**:
```bash
#!/usr/bin/env bash
set -euo pipefail
# galva-ios tags every release → we vendor BY TAG (preferred).
# Resolution:
#   $1 given  → use it verbatim (a release tag, a commit SHA, or "main")
#   no arg    → the LATEST release tag if any exist, else "main" (no tags yet)
REPO="https://github.com/Galva-io/galva-ios.git"
DEST="ios/galva-src"             # vendored, COMMITTED, and shipped in npm `files`

REF="${1:-}"
if [ -z "$REF" ]; then
  REF="$(git ls-remote --tags --refs --sort=-v:refname "$REPO" | head -1 | sed 's#.*refs/tags/##')"
  REF="${REF:-main}"             # fall back to main when no tag exists
  echo "→ no ref given; resolved to: $REF"
fi

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
git -C "$tmp" init -q
git -C "$tmp" remote add origin "$REPO"
git -C "$tmp" fetch -q --depth 1 origin "$REF"   # a tag, a branch, OR a reachable SHA all work on GitHub
git -C "$tmp" checkout -q FETCH_HEAD
COMMIT="$(git -C "$tmp" rev-parse HEAD)"

rm -rf "$DEST/Sources"; mkdir -p "$DEST"
cp -R "$tmp/Sources"    "$DEST/Sources"               # the compilable core (shipped)
cp "$tmp/LICENSE"       "$DEST/LICENSE"               # first-party; copied for provenance, not an obligation
cp "$tmp/Package.swift" "$DEST/Package.swift.ref"     # build-settings source of truth (diff on each sync); NOT shipped

SHA="$(find "$DEST/Sources" -type f -name '*.swift' | sort | xargs shasum -a 256 | shasum -a 256 | cut -d' ' -f1)"
cat > galva.lock.json <<EOF
{ "source": "$REPO", "ref": "$REF", "commit": "$COMMIT", "treeSha256": "$SHA" }
EOF
echo "→ galva-src vendored @ $COMMIT (ref=$REF)"
```
- **`galva.lock.json`** (committed): `{source, ref, commit, treeSha256}`. `ref` is the human-readable version — a **release tag** when available, else `main`; **`commit` is the real reproducible pin** (so CI re-fetches the exact tree regardless of how `ref` later moves).
- **License:** `galva-ios` is **first-party (our own repo)** → no redistribution/compliance constraint. We still ship `galva-src/LICENSE` for provenance, but it's hygiene, not an obligation.
- **`Package.swift.ref`** (not shipped): on every sync, **diff it** to catch upstream changing `linkerSettings`/`swiftSettings`/adding `resources` → then hand-sync the podspec (the only fragile spot; surface is tiny today).
- **CI drift guard:** re-run `sync-galva.sh "$(jq -r .commit galva.lock.json)"` then `git diff --exit-code ios/galva-src` → red if the vendored tree ≠ the pinned commit (anyone hand-editing → fail). *(A guard, not automation — it verifies the pin, it never bumps it.)*

**Tracking policy — TAG-first, MANUAL pin (decided 2026-06-04).**
galva-ios tags every release → we bump **to a release tag**, deliberately. Builds **never float `main`** — they always compile the `commit` recorded in `galva.lock.json`. Pulling new core code is a **human step**, never automatic:
1. `sync-galva.sh <release-tag>` (preferred) — or `sync-galva.sh` with no arg to take the latest tag automatically — or `main`/a specific SHA only while no tag exists yet.
2. Diff `Package.swift.ref` → if upstream changed `linkerSettings`/`swiftSettings` or added `resources:`, sync the podspec.
3. Build `example/` (New + Old Arch) → green.
4. Commit `ios/galva-src/Sources` + `galva.lock.json` in **one** commit.

> **No cron / no auto-PR bot** for now — kept simple. (A weekly "open-PR-if-main-moved" job is the obvious later add-on if drift-watching becomes a chore; explicitly out of scope this round.)

### 3.5 In-app message rendering on RN
A native top-level **WebView overlay** (separate `UIWindow` on iOS / transparent Activity on Android).

> **Platform split (corrected from the Android probe, §3.9).** This "build our own overlay" design is **iOS-shaped**. On **Android the core already ships the overlay** — `FullScreenInAppMessageActivity` + `ScreenMessageOverlay` + `JSBridge`, fed by a **downloaded, version-pinned WebView bundle** (local, **not** live-from-CDN). → On Android the RN wrapper **delegates to the core's built-in Activity** (`showMessage`) instead of rebuilding an overlay. The live-CDN-vs-bundle and the bridge protocol below are therefore **iOS-only**; Android inherits both from the core.

### 3.6 Native bridge wire protocol
- Outbound: single channel (`webkit.messageHandlers.galva.postMessage` on iOS / `window.galva.postMessage` via `@JavascriptInterface` on Android).
- Inbound: single `window.handleNativeMessage(jsonString)`.
- Envelope: `{name, requestId, payload}` → response `{requestId, result|error}`.

> **Android already implements this** (§3.9): the core's `JSBridge.postMessage` speaks the same `{name, requestId, payload}` envelope with a **richer method set** — `ready / dismiss / getPageContext / getMessageData / requestPurchase / openManageSubscription / openDeepLink / getProductPrice / showAlert / apiFetch`. So this section is the spec the **iOS** overlay must implement to match; Android gets it from the core. Keep the two in sync (the iOS overlay should grow the same methods).

### 3.7 Future optimization — A2: ship a prebuilt static `Galva.xcframework` (NOT now)
Kept for the record; **not implemented**. Switch to A2 only on a concrete trigger.

**What A2 is:** instead of compiling source consumer-side, *we* prebuild a **static** `Galva.xcframework`, bundle it in npm, and the podspec just **links** it (`s.vendored_frameworks`) — `pod install` does no Galva compilation.

**Triggers that would justify the switch:**
- Consumer **build time** of the vendored source becomes painful (e.g. the core grows well beyond ~10k LOC).
- We need to **hide the source** — moot: `galva-ios` is first-party and public, there's nothing to hide.
- Galva **cuts a binary release** we can consume directly **as static** (their current release is *dynamic*/Embed-&-Sign → unusable without rework, see below).

**Why A2 is NOT worth it today (the analysis we keep):**

| Axis | B (compile source) — **chosen** | A2 (ship static binary) — deferred |
|---|---|---|
| License/IP | N/A — first-party code | N/A — solves a non-problem |
| Build pipeline | **none** — CocoaPods compiles | **tricky** (see below) + CI Xcode-26 binary job + provenance |
| Podfile | zero edit (static by default) | zero edit (static binary) — *same outcome, more work* |
| swiftinterface/ABI | **N/A** (compiled fresh) | must manage module stability + `-no-verify-emitted-module-interface` |
| Consumer build time | +tens of seconds (10k LOC) | link-only |
| Consumer Xcode floor | **~26** | **~26** (bridge still parses swiftinterface) — *no real gain* |

**The tricky part of A2 (why the build is the blocker, not the benefit):** archiving the static `Galva` product yields only a `.o`, **not** a `.framework` (Galva's own script comment). To get a static framework you must either (a) archive the `Galva_dynamic` scheme but **override `MACH_O_TYPE=staticlib`** — fighting the declared `.dynamic` product type, and their dylib `install_name` patching no longer applies — or (b) build a **thin wrapper Framework target** (static) linking `Sources/`. Plus all-slices assembly (device arm64 + sim arm64/x86_64), `BUILD_LIBRARY_FOR_DISTRIBUTION=YES`, the `-no-verify-emitted-module-interface` workaround, and a CI `file … | grep 'ar archive'` static-assertion. If A2 is ever revived, the **wrapper-target route is the non-tricky primary**, the `MACH_O_TYPE` override a 30-min spike.

### 3.8 Expo support (in scope — first-class)
`@galva/react-native` **must support Expo**. The strategy is the standard one for a native-module SDK: **dev-build only, autolinked, plus a config plugin** — and crucially **NOT** a rewrite into an Expo Module. Four decisions:

**(1) Expo Go is NOT supported — and that is the normal, expected state.**
Expo Go is a **prebuilt app** (shipped on the App/Play Store): `expo start` + Expo Go only loads your **JS bundle** into that pre-compiled shell — it never re-compiles native. So the native modules it knows are **frozen at the moment Expo built that binary** (the `expo-*` set + RN core). Our SDK carries **its own native code** — the ObjC/Swift bridge **and** the vendored Galva source (45 `.swift`, compiled in-pod). That code only exists *after* a native compile, so it is simply **absent** from the Expo Go binary; at runtime `NativeModules.Galva` resolves to `null` → `"native module doesn't exist"`. This is an **architectural limit, not a bug**, and it hits **every** native lib (Firebase, RevenueCat, …), not just Galva. You cannot inject new native code into an already-built app without rebuilding it.

> **Key distinction — "managed/CNG workflow" ≠ "Expo Go".** *Expo Go* is a way to *run* (a fixed shell → no custom native). The *managed/CNG workflow* is a way to *manage the project* (no checked-in `ios/`/`android/`, regenerated from config) and **does** allow custom native modules, as long as the consumer builds their own binary. So managed users are **not** excluded — they only change **how they run**: swap Expo Go for a **development build**.

**Consumer path we document** (a **one-time** cost, not per-edit):
```bash
npx expo install expo-dev-client
npx expo prebuild           # only if they're CNG/managed
npx expo run:ios            # or run:android / EAS — builds a dev client WITH Galva inside
```
After this they have **"their own Expo Go"** (a custom dev client containing Galva). Daily dev is unchanged: `expo start` + JS hot-reload, just scanning into the dev build. Losing Expo Go costs **only the instant-QR convenience** — it does **not** cost the managed workflow, OTA updates, or JS hot-reload.

**(2) Keep the legacy bridge — do NOT rewrite as an Expo Module.**
Expo runs **RN community autolinking** during prebuild/build, so our podspec + gradle are **picked up automatically** (no manual linking, no Podfile edit beyond the usual). A plain RN native module works in an Expo **dev build** via autolinking. Rewriting against `expo-modules-core` would **force `expo-modules-core` onto every consumer** — breaking the bare / old-RN support that is the whole point (§0). → **Rejected.** One legacy bridge serves bare RN **and** Expo dev builds.

**(3) Ship an Expo config plugin (`app.plugin.js`) — the main Expo deliverable.**
`expo prebuild` **regenerates `ios/`+`android/` from config and wipes manual native edits**, so anything the SDK needs in native project files must be injected by a plugin (else CNG users lose it every prebuild). The plugin (built on `@expo/config-plugins`) injects, idempotently:
- **iOS** (`withInfoPlist` / `withEntitlementsPlist` / deployment-target mod): bump iOS deployment target → 15.0; push entitlement + `UIBackgroundModes: [remote-notification]` (push token/consent); URL scheme / associated domains (for `handleDeepLink`).
- **Android** (`withAndroidManifest` / `withAppBuildGradle`): `minSdkVersion 24`; `INTERNET` + `POST_NOTIFICATIONS` (Android 13+); deep-link intent-filter.
- Consumer opt-in is one line in `app.json`: `"plugins": ["@galva/react-native"]` (options optional).

**No runtime coupling:** `app.plugin.js` is loaded **only** by Expo's config system when present; bare RN never reads it. So `expo` / `@expo/config-plugins` stay **out of `peerDependencies`** (config-plugins is a *devDependency* for building/types; it's already present in the consumer's Expo env at prebuild). Bare / old-RN consumers are **completely unaffected**.

**(4) EAS Build & Xcode 26 — verified NON-issue (2026-06-05).**
EAS Build (hosted) picks its toolchain via `eas.json` → `build.<profile>.image`. Concern was "EAS might not ship an Xcode-26 image yet". **Checked against current Expo docs/changelog — it already does, by default:**
- The **default EAS Build image already runs Xcode 26** (currently **Xcode 26.4** on macOS Tahoe 26.4.1). The `auto` image alias (used when no `image` is set) selects it automatically.
- Apple **requires** Xcode 26 for any App Store Connect upload **from 2026-04-28**, so Expo made Xcode 26 the default ahead of that. Our Xcode-26 requirement therefore **matches EAS's default** — no special `eas.json` image, no action.
- Local `expo run:ios` with Xcode 26 installed: fine.
- Edge case only: a consumer **pinning an old `image`** in `eas.json` (e.g. for SDK ≤ 53) would be on an older Xcode — they'd just drop the pin / use `auto`. We document this, but it's a one-line consumer config, not a blocker.

> Was filed as a Medium risk; **verification downgraded it to ~none** — the hosted Xcode floor we worried about is already the EAS default.

> **Net:** Expo = **dev build + autolinking + config plugin**. No Expo Module rewrite, no peerDep coupling, bare RN untouched. The only genuinely Expo-shaped risk is the **EAS Xcode-26 image availability**.

### 3.9 Android distribution & wrapper — Maven AAR, NOT vendored source (the mirror-image of iOS)

> **Major correction to earlier assumptions.** The doc previously said "Android core not shipped yet → stub; `io.galva:sdk` unavailable." **Probing `Galva-io/galva-android` @ `identity-module` (2026-06-08) shows the core already exists as a complete, production-shaped SDK** — it is *unreleased*, not *unbuilt*. The Android distribution story is therefore the **opposite** of iOS, and far simpler in shape.

**Ground truth (probed 2026-06-08, branch `identity-module`):**

| Aspect | Fact |
|---|---|
| Shape | **Real multi-module Gradle SDK** (10 modules: `common`, `core`, `identity`, `local-storage`, `network`, `operation-queue`, `inapp-message`, `billing`, `galva-sdk`, `build-logic`). Not a stub. |
| Consumer artifact | The `:galva-sdk` facade — `io.galva.sdk.Galva` (singleton `Galva.instance` + `Galva.configure(context, configuration)`). `core` `api`-exposes every other module. |
| Toolchain | **compileSdk 36, minSdk 24, Java 17, Kotlin 1.9, AGP 9.0** → these become the **consumer floor** on Android. |
| Publishing | **Already wired** — `vanniktech` maven-publish convention on every module, targeting **Maven Central** + **GitHub Packages** (`maven.pkg.github.com/Galva-io/galva-android`). |
| **Release status** | **NOT released.** `VERSION_NAME = 1.0.0-SNAPSHOT`. The README's Maven-Central badge + `io.galva:sdk:1.0.0` are **aspirational**. |
| **Coordinate** | **Unsettled.** `gradle.properties` `GROUP=io.galva.sdk` + artifactId `galva-sdk` → `io.galva.sdk:galva-sdk`; README says `io.galva:sdk`. Pin nothing until this is final. |
| Transitive deps | **NOT self-contained (unlike iOS's 0 Swift deps).** Pulls kotlinx-coroutines + serialization-json, **OkHttp 5**, androidx (appcompat, activity(-ktx), lifecycle-process, **webkit**, datastore), **Play Billing 8 — `compileOnly`**, GMS advertising-id, `desugar_jdk_libs`. On Android this is **fine**: Gradle/Maven resolve the transitive graph natively. |
| Manifest | The AAR's own manifest declares `INTERNET` + `ACCESS_NETWORK_STATE` and the `FullScreenInAppMessageActivity` → **merged into the host app for free**. |
| ProGuard | Ships `consumer-rules.pro` in the AAR (kotlinx-serialization keeps + `io.galva.**` public-API keeps) → **R8/minify works out of the box**; the RN wrapper adds nothing. |

**Decision: Android = depend on the published Maven AAR; do NOT vendor source, do NOT compile the core, no NDK.**
This is the clean, native Android path and the exact opposite of iOS's mode-B source-vendoring (which existed only because iOS had no usable binary channel — Android has Maven).
```kotlin
// android/build.gradle of @galva/react-native — once the core is published
dependencies {
  implementation("io.galva.sdk:galva-sdk:<version>")            // coordinate TBD — see table
  implementation("com.android.billingclient:billing-ktx:8.0.0") // core declares billing COMPILEONLY → wrapper (or host) must add it
}
```
- **Autolinking** wires our `GalvaModule.kt` into the host Gradle build; the AAR supplies the core + its transitive graph. The consumer adds **no** Gradle lines.
- **No `galva.lock.json` equivalent on Android** — the version string in `build.gradle` *is* the pin; Gradle resolves the rest reproducibly.
- The **Expo Android config plugin (§3.8) shrinks**: `INTERNET` already comes from the AAR manifest → the plugin only needs `POST_NOTIFICATIONS` (Android 13+) + any deep-link intent-filter + the `minSdk 24` / `compileSdk 36` / Java-17 floor bump.

**Decision: transitive-dependency strategy — forward the core's constraints only; add no defensive layer yet.**
The wrapper does the minimum: `implementation` the AAR + `billing-ktx`, and **inherit whatever versions the core resolves**. We deliberately do **not** add `safeExtGet` overrides, a `galva-bom` import, or `resolutionStrategy.force` now. Rationale:
- **The core itself solves transitive conflicts only *internally*** — a Gradle **Version Catalog** (`gradle/libs.versions.toml`) pins all 10 modules to one coherent set (OkHttp `5.3.2`, coroutines `1.11.0`, Billing `8.0.0`…). But a Version Catalog is **build-time only — it does NOT travel into the published AAR**: consumers receive the *resolved* versions as ordinary transitive deps in the POM/`.module` metadata, and the host app's Gradle still runs "highest-version-wins" against them. The core ships **no BOM, no dependency constraints, no `force`** → it pushes consumer-side reconciliation entirely onto us.
- **Our stance (this round): mirror the core, don't second-guess it.** If/when the core publishes a BOM or constraints, the wrapper adopts them (e.g. `implementation(platform("io.galva…:galva-bom:<v>"))`) and tracks the core's versions verbatim. Until then we ship no override surface — fewer knobs to drift out of sync, and any real conflict in a host app is solved *there* (the app can always add its own `force`).
- **Upstream asks (logged, not blocking us):** (1) publish a **`galva-bom`**; (2) fix three build bugs found in the catalog — `kotlinx-serialization-*` pinned to the *coroutines* version ref (wrong version line), `lifecycle-process` using `version = "lifecycle"` (literal string, not `version.ref`), and **`mockwebserver` declared as `implementation` (not `testImplementation`) in `:network`** → a test lib leaking into the production AAR.

**The real near-term blocker — the core is unreleased (`-SNAPSHOT`).** Until a release tag + final coordinate land, in priority order:
1. **Stub the Android module** (API surface returns mocks) so JS + the example app keep building — exactly the existing Phase-3 plan, just now a *temporary* state, not a permanent "core doesn't exist."
2. For internal dev, consume via **GitHub Packages** (already configured; needs a token) or **`publishToMavenLocal`** (`mavenLocal()`).
3. Flip to the **Maven Central** coordinate the moment `io.galva*:…:1.0.0` ships; pin an exact version.

**API parity gap — iOS ↔ Android cores diverge. Decision: iOS is the canonical surface.**
When a method exists on one side but not the other, **iOS wins** — the RN TS surface (§6.2) is **iOS-shaped**, and Android is brought up to it (not the intersection). Concretely:
- **iOS-only methods** (`setPushToken` / `clearPushToken` / `setPushConsent` / `setPushCategory` / `pushConsent` / `isPushCategoryEnabled`, `setEmail` / `setDisplayName`, discrete `reconcileTransactions` / `handleDeepLink` / `accountToken` / `deviceId` / `sdkVersion`) **stay in the surface**. On Android, back them by the nearest core primitive where one exists (`setEmail`/`setDisplayName` → `updateProperties(vararg ProfileProperty)`; email also via the `identify(email)` arg), and **stub the rest** (no-op or `rejectNotImplemented`) until the Android core grows them. Log each Android stub so the gap is visible, and file the missing methods as **upstream asks** on galva-android.
- **Android-only surface (`billing: BillingManager`)** is **surfaced to JS as an `@platform android` method** (§6.2) — backed by the core's `BillingManager` on Android, **stubbed/rejected on iOS** (Galva exposes no billing API there). It is the first and only Android-only member of the surface. (Purchases still execute via native StoreKit 2 / BillingClient — §1.)
- **IAM delivery differs but is hidden in the bridge**: Android = `getInAppMessage(): Flow<Message>` + `showMessage(activity, message)`; iOS = a `messages` emitter. The RN bridge maps the Android **Flow → a `NativeEventEmitter` event**, so the **JS surface stays identical** (`messages` emitter, iOS-shaped) on both.
- → **§6.2's TS surface is transcribed from iOS.** `parity-check.ts` (§7) diffs the surface against **both** cores, but treats an Android-missing method as a **known stub (tracked TODO), not a surface removal**; it flags only *iOS*-missing methods as real errors.

**IAM rendering on Android — reuse the core's own overlay, don't rebuild it:**
The Android core already ships the full WebView overlay — `FullScreenInAppMessageActivity` + `ScreenMessageOverlay` + a `JSBridge` (`@JavascriptInterface postMessage`) — and the content is a **downloaded, version-pinned WebView bundle** (`WebViewBundleResolver`/`Cache`/`Downloader`), i.e. a local bundle, **NOT** live-from-CDN. Its bridge protocol is **richer** than §3.6's envelope: methods `ready / dismiss / getPageContext / getMessageData / requestPurchase / openManageSubscription / openDeepLink / getProductPrice / showAlert / apiFetch`, all `{name, requestId, payload}`. → On Android the RN wrapper should **delegate to the SDK's built-in Activity overlay** (`showMessage`) rather than build a parallel transparent-Activity overlay in the RN layer. **Consequence: §3.5/§3.6 are iOS-shaped** — see the platform-split note added there.

> **Net (Android):** consume the Maven AAR (`implementation`), let Gradle resolve the transitive graph, autolink the bridge, delegate IAM to the core's own Activity overlay, add `billing-ktx` (core is `compileOnly`). Blocked only by **release status** (`-SNAPSHOT`) and an **unsettled coordinate** — stub until `1.0.0` ships. **Mirror-image of iOS: no vendoring, no compile, but a publish dependency instead.**

> ⚠️ **Security (out-of-band, urgent — not an RN-SDK task but blocks any Android release):** `gradle.properties` on `identity-module` commits **live publishing secrets** (Sonatype/Maven-Central credentials, the GPG **signing private key + passphrase**, signing key id) into a **public** repo → anyone can publish forged `io.galva` artifacts. **Rotate before any release:** revoke the Sonatype token, revoke + regenerate the GPG key, purge the values from git history (filter-repo/BFG — not just a new commit), and move them to env vars / `~/.gradle/gradle.properties` (never committed).

---

## 4. Toolchain / version matrix

| Axis | Old project | New project (habitify-rn) | Notes |
|---|---|---|---|
| RN | **unconstrained** | 0.85.3 | no floor declared; below autolinking → link manually |
| React | (per RN) | 19.2.3 | |
| Arch | Old or New | New (default) | one package covers both via interop |
| iOS deploy target | bump → 15.0 | ~15.1 | Galva / StoreKit 2 floor |
| Android minSdk | bump → 24 | ~24 | Galva floor |
| **Xcode (consumer)** | **26+ — accepted** | 26+ | pod compiles Galva's Swift-6 source + iOS-26 SDK symbol |
| Galva iOS core | **vendored source, compiled in pod (B)** | same | pinned by commit (`galva.lock.json`) |
| Android minSdk / compileSdk / Java | bump → 24 / 36 / 17 | 24 / 36 / 17 | core's floor (§3.9) |
| Galva Android core | **exists, unreleased** → **Maven AAR** (stub until `1.0.0`) | same | `io.galva…:galva-sdk` (coordinate TBD); no vendoring (§3.9) |
| **Expo** | dev build + `app.plugin.js` | dev build + `app.plugin.js` | **Expo Go unsupported**; EAS needs Xcode-26 image (§3.8) |

`package.json`:
```jsonc
"sideEffects": false,
"peerDependencies": { "react": "*", "react-native": "*" },
"galva": { "iosCoreRef": "<release tag, or 'main' while none exists>", "iosCoreCommit": "<sha — both mirror galva.lock.json>" },
"files": [
  "src", "ios/bridge", "ios/*.podspec",
  "ios/galva-src/Sources", "ios/galva-src/LICENSE",   // B: vendored first-party source (+ LICENSE for provenance)
  "galva.lock.json",                                  // provenance of the vendored source
  "app.plugin.js", "plugin/build",                    // Expo config plugin (§3.8) — bare RN ignores it
  "scripts", "android", "*.md"
  // NOTE: ios/galva-src/Package.swift.ref is NOT shipped (settings-diff reference only)
]
```
> Ships the vendored **source** (+ `LICENSE` for provenance; first-party code, no obligation). No floor is declared anywhere. The `respond_to?(:install_modules_dependencies)` guard and JS feature-detection are **graceful degradation**, not floor enforcement. peerDeps `*` reflects the primitive/version-agnostic stance.

---

## 5. Package structure

```
@galva/react-native/
├─ src/
│  ├─ index.ts            # PUBLIC ENTRY — re-export ONLY (no logic), one line per api/* export
│  ├─ api/                # one named export per file (configure.ts, identify.ts, show.ts, …) — flat, tree-shakeable
│  ├─ types.ts            # shared types, discriminated unions + type guards
│  └─ NativeBridge.ts     # NativeModules + NativeEventEmitter wiring (internal, not re-exported)
├─ ios/
│  ├─ bridge/             # RN bridge — Swift + .m (RCT_EXTERN_*)
│  │  ├─ Galva.swift
│  │  ├─ Galva.m
│  │  └─ GalvaOverlayWindow.swift
│  ├─ galva-src/          # VENDORED Galva source (sync-galva.sh @commit) — Sources/ + LICENSE shipped; Package.swift.ref not shipped
│  └─ galva-react-native.podspec  # B: compiles bridge + galva-src/Sources (static by default)
├─ galva.lock.json        # COMMITTED provenance: { source, ref, commit, treeSha256 }
├─ android/
│  ├─ src/main/java/.../GalvaModule.kt
│  ├─ src/main/java/.../GalvaOverlayActivity.kt
│  ├─ consumer-rules.pro
│  └─ build.gradle        # minSdk 24, conditional New Arch
├─ plugin/                # Expo config plugin source (TS) — builds to app.plugin.js
│  └─ src/index.ts        # withInfoPlist/withEntitlements/withAndroidManifest mods (§3.8)
├─ app.plugin.js          # Expo plugin entry (built) — referenced by consumer "plugins": ["@galva/react-native"]
├─ example/               # app testing both Old & New Arch
├─ scripts/
│  ├─ sync-galva.sh          # fetch galva-ios @ pinned commit → vendor into ios/galva-src + write galva.lock.json (public repo, no auth)
│  └─ parity-check.ts        # reconcile API surface against the native core
└─ package.json
```

> **Barrel rule, scoped:** the package's public `src/index.ts` **is** the entry point — it MUST re-export the flat `api/*` surface (this is what enables `import { configure } from '@galva/react-native'`, lodash-es style) and must be **re-export-only** with `"sideEffects": false` so bundlers tree-shake unused exports. This is the *only* sanctioned barrel. **Do not** add convenience barrels inside sub-folders or have internal modules import through `index.ts`; internal code imports directly from the source path.

---

## 6. API surface (TS, 1:1 with native)

### 6.1 Export style — flat named exports (lodash-es style)

Every API is a **standalone named export** at the package root, consumed exactly like `lodash-es`:

```ts
import { configure, identify, show, messages } from '@galva/react-native';
```

- **No default export, no namespace object.** We do **not** ship `import Galva from '@galva/react-native'` / `Galva.configure()`. Each function is its own top-level binding.
- **Rationale:** tree-shakeable (a consumer importing only `configure` doesn't pull `show`/emitters into the bundle), matches the idiom the consumer asked for (`import { isEmpty, isNil } from 'lodash-es'`), and keeps the public surface a flat list that `parity-check.ts` can diff 1:1 against the native methods.
- **ESM-first, `"sideEffects": false`** so Metro/bundlers can drop unused exports. Each export lives in its own module under `src/api/*`, re-exported from `src/index.ts` (re-export only — **no logic in the barrel**).
- **Emitters** (`messages`, `offerErrors`, `identityChanges`) follow the **`@react-native-firebase` convention**: each is a **subscribe function that returns a plain `unsubscribe` function** —
  ```ts
  const unsubscribe = messages(msg => { /* … */ });
  // later
  unsubscribe();
  ```
  Not an object with `.remove()`, not `addListener/removeListener` — a bare callable, exactly like `onMessage`/`onAuthStateChanged` in RN Firebase.

### 6.2 The surface (1:1 with native)

`configure`, `identify`, `logout`, `userId`, `accountToken`, `isAnonymous`,
`setPushToken`, `clearPushToken`, `setPushConsent`, `setPushCategory`, `pushConsent`, `isPushCategoryEnabled`,
`setEmail`, `setDisplayName`, `setUserProperty`, `removeUserProperty`,
`messages` (emitter), `show`, `checkForMessages`,
`offerErrors` (emitter), `identityChanges` (emitter),
`reconcileTransactions`, `handleDeepLink`, `setLogLevel`, `deviceId`, `sdkVersion`,
`billing` (**`@platform android`** — backed by the core's `BillingManager`; stubbed/rejected on iOS).

#### Android parity stub checklist (verified against `Galva-io/galva-android` @ `identity-module`, 2026-06-08)

iOS is canonical (§3.9). Each iOS surface member maps to one of three buckets on Android. **A** = runs straight through; **B** = backed by a different core primitive (shim); **C** = no Android backing → ship a stub (`rejectNotImplemented`/no-op + log) **and** file an upstream ask on galva-android.

| iOS surface | Bucket | Android backing / action |
|---|---|---|
| `configure` | A | `Galva.configure(context, configuration)` |
| `identify` | A | `identify(userId, email?, obfuscatedAccountId?)` |
| `logout` | A | `logout()` |
| `userId` | A | `currentUserId` |
| `isAnonymous` | A | `isAnonymous` |
| `setLogLevel` | A | `setLogLevel(level)` |
| `messages` (emitter) | A | `getInAppMessage(): Flow<Message>` → `NativeEventEmitter` |
| `show` | A | `showMessage(activity, message)` |
| `setEmail` | B | `updateProperties(ProfileProperty.Email(email))` (or `identify(email=…)`) |
| `setDisplayName` | B | `updateProperties(ProfileProperty.Custom("displayName", …))` |
| `setUserProperty` | B | `updateProperties(ProfileProperty.Custom(key, value))` |
| `accountToken` | B | `obfuscatedAccountId` — ⚠️ confirm semantics (Play obfuscated id ↔ StoreKit appAccountToken) |
| `identityChanges` (emitter) | B | `identity.state: StateFlow<Identity>` → emitter (`Identity` carries userId/email/anonymousId/obfuscatedAccountId/isAnonymous) |
| `sdkVersion` | B | `io.galva.sdk.BuildConfig.SDK_VERSION` (public AAR field — read directly, not on facade) |
| `checkForMessages` | B | no-op — Android IAM is a reactive `Flow`, no manual poll needed |
| `setPushToken` | **C** | no push subsystem → stub + upstream ask |
| `clearPushToken` | **C** | stub + upstream ask |
| `setPushConsent` | **C** | stub + upstream ask |
| `setPushCategory` | **C** | stub + upstream ask |
| `pushConsent` | **C** | stub (return default) + upstream ask |
| `isPushCategoryEnabled` | **C** | stub (return `false`) + upstream ask |
| `reconcileTransactions` | **C** | not exposed on facade (billing reconciles internally) → stub + upstream ask |
| `handleDeepLink` | **C** | deep-link lives only inside IAM `JSBridge.openDeepLink`, no public entry → stub + upstream ask |
| `deviceId` | **C** | no getter → stub + upstream ask |
| `offerErrors` (emitter) | **C** | no error stream anywhere (`OperationManager`/`InAppMessagingManager` expose none; `BatchSender.send(): Result` not surfaced) → silent emitter + upstream ask |
| `removeUserProperty` | **C** | `ProfileProperty` is value-only + identity merges (`properties + extra`), no delete path → stub + upstream ask |
| `billing` | **D (Android-only)** | `BillingManager` from the Android core → surfaced to JS as `@platform android`; **stubbed/rejected on iOS** (Galva exposes no billing API there) |

**Tally:** A = 8 · B = 7 · C = 11 · **D (Android-only) = 1** (`billing`).

**Platform tagging — every platform-specific method is marked, not silently stubbed.** Bucket-C methods are tagged **`@platform ios`** (iOS-only); `billing` is tagged **`@platform android`** (Android-only) — the symmetric case. Both stay exported on **both** platforms (so cross-platform call sites typecheck), carry a JSDoc `@platform …` tag + appear in the docs' platform-availability matrix, and on the **unsupported** platform they **no-op (void/emitter) or reject (`rejectNotImplemented` with the method name) + log once** — never a silent success. So:
- **`@platform ios`** = the 11 bucket-C methods → backed on iOS, stubbed on Android.
- **`@platform android`** = `billing` → backed on Android (`BillingManager`), stubbed on iOS.
Rule of thumb: **iOS-only = bucket C; Android-only = a capability we surface that iOS lacks (today: just `billing`).**

```ts
/** Register the device's push token. @platform ios — no-op on Android (no push subsystem; tracked upstream). */
export function setPushToken(token: string): void
```

**Upstream asks for galva-android (6 capability gaps to reach iOS parity):** (1) **push subsystem** — the 6 `*Push*` methods; (2) **deep-link** public entry; (3) `reconcileTransactions`; (4) `deviceId`; (5) **offer/error stream** for `offerErrors`; (6) **remove-property** API for `removeUserProperty`. `parity-check.ts` (§7) treats every `@platform ios` (bucket-C) row as a **tracked TODO**, not a surface removal; it errors only when an iOS method is missing *and untagged*. When an upstream gap is filled, **drop the `@platform ios` tag** and move the row A/B — the tag's removal is the parity-restored signal.

---

## 7. Phased plan

### Phase 0 — Scaffold & spike (can start now)
- `create-react-native-library`, strip the codegen spec, set up the legacy bridge.
- **Interop spike:** verify the legacy bridge runs on New Arch at a few old RN marks (0.68–0.70) + 0.85.
- ✅ **Static-build cost audit (done):** `Package.swift` has `dependencies: []` + no `resources:` → podspec mapping is just `s.libraries = 'sqlite3'`.

### Phase 1 — iOS: vendored source + bridge (the foundation)
- `scripts/sync-galva.sh` vendors Galva source **@ pinned commit** (real files + `galva.lock.json`, §3.4.1) + CI drift guard. Public repo, **no auth**.
- B podspec (§3.4): compiles `bridge/**` + `galva-src/Sources/**`, `sqlite3`, Swift 6, static by default.
- Swift/ObjC bridge for the full API surface §6; `NativeEventEmitter` for `messages` / `offerErrors` / `identityChanges`.
- Example app runs on New Arch — verify **zero Podfile edit** and a clean build links statically (no `use_frameworks!`).

### Phase 2 — In-app message overlay (iOS)
- `GalvaOverlayWindow` separate `UIWindow`, WebView loads `content_url` live, wire the bridge protocol §3.6.

### Phase 3 — Android (core exists, unreleased — §3.9)
- Stub module first (API surface returns mocks) so JS/example don't break while the core is `-SNAPSHOT`.
- When released: `implementation("io.galva…:galva-sdk:<v>")` (final coordinate TBD) + `implementation("com.android.billingclient:billing-ktx:8.0.0")` (core is `compileOnly`). **No source vendoring** — Gradle resolves the transitive graph; autolinking wires `GalvaModule.kt`.
- **Delegate IAM to the core's `FullScreenInAppMessageActivity`/`showMessage`** (map `getInAppMessage(): Flow<Message>` → `NativeEventEmitter`) — do **not** rebuild the overlay (§3.5/§3.9).
- Reconcile the **API parity gap** — **iOS is canonical** (§3.9/§6.2): keep iOS-only methods in the surface and **stub them on Android** (back by `updateProperties`/`identify(email)` where possible, else `rejectNotImplemented` + log). Surface Android-only `billing` as `@platform android` (backed by `BillingManager`; stubbed on iOS).
- Floor: compileSdk 36 / minSdk 24 / Java 17. Interim source: GitHub Packages or `mavenLocal`.

### Phase 3.5 — Expo config plugin (after iOS bridge is green)
- Author `plugin/src/index.ts` → `app.plugin.js`: iOS deployment-target bump + push entitlement + `UIBackgroundModes` + URL scheme; Android minSdk 24 + permissions + deep-link intent-filter (§3.8). Idempotent mods.
- Add an **Expo dev-build example** (or `expo prebuild` the existing example) → verify autolinking pulls the pod, the plugin injects config, and a dev client runs Galva. Document the `expo-dev-client` / `prebuild` / EAS path (Expo Go intentionally unsupported).

### Phase 4 — Hardening
- `parity-check.ts` in CI, docs, integration examples for old + new, release pipeline.

---

## 8. CI matrix
- **iOS:** **B** (compile vendored source) × {Old Arch, New Arch} × {floor RN, RN 0.85}. Assert **static linkage** (no `use_frameworks!`) and **zero Podfile edit**; clean build compiles the core, incremental does not.
- **galva-src drift guard:** `sync-galva.sh "$(jq -r .commit galva.lock.json)"` then `git diff --exit-code ios/galva-src` (anonymous clone of the public repo).
- **`Package.swift.ref` settings-diff:** flag if upstream adds `resources:`/deps/swiftSettings the podspec must mirror.
- **Android:** {Old Arch, New Arch} (stub) → expand when the core ships.
- `parity-check` runs every PR.

---

## 9. Risks & mitigations

| Risk | Level | Mitigation |
|---|---|---|
| Consumer must compile Galva + use Xcode 26 (incl. old RN) | **Accepted** | Decided in sync with the native core (§3.3); ~10k LOC compiles in tens of seconds; A2 couldn't actually avoid the ~26 floor anyway |
| `Package.swift` settings drift each sync (resources/deps/swiftSettings) | Low | Audited trivial today (`dependencies: []`, only `sqlite3`, no `resources`); `Package.swift.ref` diff + CI guard (§3.4.1) catch changes |
| Upstream later adds `resources:` → static-source needs a `.bundle` | Low | The settings-diff guard flags it; map to `s.resource_bundles` if it happens |
| Pinning the core version | Low | Vendor **by release tag** (galva-ios tags each release); fall back to `main` until the first tag. Lock records `ref` + resolved `commit` |
| `Galva`-module-vs-`Galva`-type name collision | Low | Only bit the `.swiftinterface` *verifier* under distribution builds — **B never emits a distributable interface**, so it doesn't apply |
| Interop not solid on old RN (0.68–0.70) | Medium | Phase 0 spike; document the empirically-working marks (don't turn them into a floor) |
| Android core **unreleased** (`1.0.0-SNAPSHOT`) + coordinate unsettled | Medium | Core **exists** & is publish-wired (§3.9). Stub now; flip to the Maven AAR on release. Interim: GitHub Packages / `mavenLocal`. Mirror-image of iOS — no vendoring |
| iOS↔Android API parity gap (push/email/deeplink absent on Android; billing Android-only) | Medium | **iOS canonical** — iOS-only methods tagged `@platform ios`, stubbed on Android (`updateProperties`/`identify` where possible, else not-implemented + log); `billing` tagged `@platform android`, stubbed on iOS. `parity-check` flags only iOS-missing-untagged as errors (§3.9/§6.2) |
| galva-android public repo leaks live publishing secrets | **High (their repo, not RN)** | Out-of-band: rotate Sonatype token + GPG key, purge git history, move to env/`~/.gradle` (§3.9). Blocks any Android release until fixed |
| RN below autolinking must link manually | Low | Document manual-link instructions; doesn't block, no floor set |
| Source compile cost grows if the core balloons | Low (watch) | Trigger to revisit **A2** (§3.7) if build time becomes painful |
| ~~EAS Build lacks an Xcode-26 image~~ | **None (verified 2026-06-05)** | EAS **default image already = Xcode 26.4**; `auto` alias picks it; Apple mandates Xcode 26 for App Store uploads from 2026-04-28 → our floor matches the EAS default. Only edge: consumer pinning an old `image` → drop the pin (§3.8) |
| Expo users expect Expo Go to work | Low | Document up front: native lib → **dev build required** (normal for Firebase/RevenueCat too); managed workflow preserved, only the run target changes (§3.8) |

---

## 10. Open questions

- ✅ ~~Dual-mode vs source-only / A2 vs B~~ → **B (compile vendored source) is PRIMARY**; A2 (ship static binary) demoted to a future optimization (§3.7). *(decided 2026-06-04 — see §0 decision record)*
- ✅ ~~License to ship source~~ → **N/A: `galva-ios` is first-party (our own repo)** → no license/IP constraint at all.
- ✅ ~~`resources` / transitive deps~~ → audited: `dependencies: []`, no `resources:`, only `sqlite3`.
- ✅ ~~Where to pin (tag vs commit)~~ → **by release TAG** (galva-ios tags each release); fall back to `main` only while no tag exists. Lock records `ref` + resolved `commit`. **Validated:** anonymous `git fetch --depth 1 origin <tag|branch|sha>` + `Sources/` self-contained (system frameworks + system `SQLite3` only, 0 transitive Swift deps).
- ✅ ~~How to track upstream~~ → **tag-first, manual pin** (no cron/auto-PR); builds never float `main` (§3.4.1).
- ✅ ~~Consumer Xcode floor~~ → **26+, accepted** (incl. old RN — assumed accepted).
- ✅ ~~Emitter API shape~~ → **Firebase convention**: subscribe fn returning a plain `unsubscribe()`.
- ✅ ~~Old project Old vs New Arch~~ → **irrelevant**; the lib supports **both** by design.
- ✅ ~~Android scope~~ → **iOS-first; Android stub this round.** But the core **exists** (`identity-module` = full multi-module SDK, `1.0.0-SNAPSHOT`) → Android = **consume the Maven AAR, no vendoring** (mirror-image of iOS, §3.9). Open follow-ups: final **coordinate** (`io.galva.sdk:galva-sdk` vs `io.galva:sdk`), **release** of `1.0.0`, **API-parity** (decided: **iOS canonical** — stub iOS-only methods on Android until the core catches up), **deps** (decided: forward the core's constraints only, no defensive layer; ask upstream for a BOM + fix 3 catalog bugs), and the upstream **secret-leak** rotation.
- ✅ ~~Expo support~~ → **first-class via dev build + `app.plugin.js`** (§3.8). Expo Go unsupported (custom native); **no** Expo Module rewrite; **no** `expo` peerDep (bare RN untouched). Risk = EAS Xcode-26 image.

**→ No open blocking questions remain. Ready to start Phase 0/1.**

---

## 11. Appendix — distribution per docs
- iOS: SPM `github.com/Galva-io/galva-ios` (first-party, public) + (their future, **dynamic**) `Galva.xcframework`. **Not** on CocoaPods trunk. We compile the **vendored source** in our own podspec.
- Android: Maven AAR — coordinate **TBD** (`io.galva.sdk:galva-sdk` per `gradle.properties` vs `io.galva:sdk` per README), **`1.0.0-SNAPSHOT`, not yet released**. Multi-module Gradle SDK, vanniktech-published to Maven Central + GitHub Packages. RN wrapper `implementation`s it (no vendoring) — §3.9.
- RN: npm `@galva/react-native` — bare RN **and** Expo (dev build + bundled `app.plugin.js`; not Expo Go).
- Flutter: `galva_flutter`.
