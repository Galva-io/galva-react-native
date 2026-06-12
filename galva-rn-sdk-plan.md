# `@galva/react-native` (RN RevFlow) — Build Plan

> Status: **rev 2 — updated post-Phase-1** · Date: 2026-06-04, revised 2026-06-11 · Owner: thaitd
> Goal: wrap the Galva Client SDK for React Native, **support both old & new projects**, **lowest possible RN footprint**.
>
> **Progress: Phase 0 + Phase 1 DONE & verified 2026-06-11** — vendored core compiles statically inside the pod (zero Podfile edit, `libGalva.a` confirmed `ar archive`), full bridge + 23-export JS surface, example app green on RN 0.85 / New Arch / Xcode 26.5.
> **rev 2 changes:** §6 rewritten against the **real** core facade (the original draft assumed APIs the core doesn't have); the wrapper-built overlay + wire-protocol sections and the overlay phase **deleted** (both cores ship their own presenter — `message.show(in:)` — so the wrapper builds no overlay), with later §3.x and phases renumbered (now: Phase 2 = Android, 2.5 = Expo plugin, 3 = hardening); §3.4/§5 corrected to the as-built layout (`Galva.podspec` at repo root, `GalvaModule.swift`); Android parity table reset pending a re-probe at Phase 2.

---

## 0. TL;DR (read this first)

- **One single package** `@galva/react-native` covering both Old Arch and New Arch — **do not split into 2 packages**.
- Author native via **legacy `RCTBridgeModule` + `NativeEventEmitter` + TurboModule interop** → most primitive API, **no RN floor declared**, still runs on New Arch.
- iOS core (`Galva-io/galva-ios`) is **first-party (our own repo), SPM-only, Swift 6, public**, **requires Xcode 26 to build**, **no CocoaPods**; **tagged per release** (none yet → fall back to `main`).
- **iOS distribution = B (compile source in the pod) — PRIMARY (decision 2026-06-04).** We **vendor Galva's Swift source** into the package and let **CocoaPods compile it** (`s.source_files`). CocoaPods' **default linkage is static** → links into the app with **no `use_frameworks!`**, **Do Not Embed**, **zero Podfile edit**. No prebuilt binary, no xcframework build.
- **A2 (ship a prebuilt static `Galva.xcframework`) is demoted to a future optimization** (§3.5), kept with full analysis. We switch to it only if a concrete trigger appears (Galva cuts a binary release, or consumer build-time / Xcode floor becomes a real pain).

### Why B, not A2 (decision record — 2026-06-04)
We initially chose A2 (ship binary). Two findings flipped it:

1. **`galva-ios` is first-party** — it is **our own repo**, not a third-party SDK. So the entire license / IP-exposure / "source not redistributable" concern that originally pushed us to A2 **never applied**: we own the source, we can vendor and ship it freely.
2. **The codebase is small** — **46 Swift files / ~10,400 LOC** (at the pinned commit `95c86a1`). Compiling it is **tens of seconds clean, ~0 incremental** — not a Firebase-scale burden.

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
- **Android core EXISTS but is UNRELEASED** (`Galva-io/galva-android` @ `identity-module` = full multi-module Gradle SDK, `1.0.0-SNAPSHOT`, coordinate unsettled). Android = **consume the Maven AAR** (`implementation`), **not** vendor source — the mirror-image of iOS (§3.7). iOS-first initially; Android **stub until `1.0.0` ships**. ⚠️ Its public repo also leaks live publishing secrets — rotate before any release (§3.7).
- **Expo = first-class via dev build** (§3.6): autolinked legacy bridge + an `app.plugin.js` config plugin. **Expo Go not supported** (custom native → dev build / prebuild / EAS required — normal for any native lib). **No** rewrite to an Expo Module; **no** `expo` peerDep → bare RN untouched. EAS Xcode-26 worry **verified a non-issue** — EAS's default image is already Xcode 26.4 (§3.6).

**Open questions:** none blocking — see §10.

---

## 1. Context & scope

Galva = subscription **retention** platform. The Client SDK is intentionally thin, 5 responsibilities:
1. Identity mapping (anonymous ↔ identified user)
2. In-app message display
3. Offer redemption prompt
4. Push token + consent management
5. Session tracking

**Billing:** Galva *does* orchestrate purchases internally (native `BillingManager` / `:billing` module on Android + the IAM `requestPurchase` bridge — §3.7), but the actual purchase always executes via the platform's native **StoreKit 2 / BillingClient**. On **iOS** no billing API is surfaced to JS (the host owns its purchase flow). On **Android** the core exposes `BillingManager`, so billing **is** surfaced to JS as an **Android-only** API (`@platform android` — §6.2). (Earlier drafts said "no billing logic" — imprecise: the SDK has billing logic; what was meant is "no billing API on iOS.")

Two consumers we must serve:
- **New project** = `habitify-rn` — **RN 0.85.3 / React 19.2.3**, New Arch default, iOS ~15.1 / Android API ~24.
- **Old project** = *(RN version TBD)* — **assumed to accept Xcode 26**.

Both bare-RN and **Expo** consumers are in scope. Expo is served via a **development build** (not Expo Go) plus a config plugin — see §3.6.

---

## 2. Ground truth: repo `Galva-io/galva-ios`

| Aspect | Fact (verified 2026-06-04) |
|---|---|
| Ownership | **First-party — our own repo.** No license/IP constraint on vendoring or shipping the source |
| Visibility | **Public** — `git ls-remote` succeeds anonymously → CI needs **no token/auth** |
| Distribution | **SPM-only**, `swift-tools-version: 6.0`, `platforms: [.iOS(.v15), .macOS(.v12)]` |
| Size | **46 Swift files, ~10,400 LOC** (at pinned commit `95c86a1`) → cheap to compile (tens of seconds clean; verified Phase 1) |
| Target | `.target(name: "Galva", path: "Sources", linkerSettings: [.linkedLibrary("sqlite3")])` — **`dependencies: []`**, **no `resources:`**, no `swiftSettings` |
| Products | **`Galva` (static, default for SPM source consumers)** + `Galva_dynamic` (`type: .dynamic`, by its own comment "used ONLY by `scripts/build-xcframework.sh`" → their prebuilt release is **dynamic**) |
| Tags / releases | **Tagged per release** going forward; **none yet** → fall back to `main`. We vendor **by tag** (→ resolved commit in lock) |
| CocoaPods | **"Not supported"** — no podspec → **we author our own** |
| Build | **Xcode 26+** (StoreKit offer uses `promotionalOffer(_:compactJWS:)` — an iOS 26 SDK symbol, `@backDeployed` to iOS 15 runtime) |
| React Native | **Not mentioned at all** |

**Consequences:**
- We embed the iOS core via **CocoaPods** → author our own podspec that **compiles the vendored source** (mode B).
- First-party + public + small + trivial manifest → **source distribution is the natural, supported path** (Galva's `Galva` product is literally "the default for SPM source consumers").

> **Android:** the native core **exists** (`Galva-io/galva-android` @ `identity-module` — a complete multi-module Gradle SDK) but is **not released** (`1.0.0-SNAPSHOT`, coordinate unsettled). Android wrapper **depends on the Maven AAR** (no vendoring) — stub/mock first, flip to `implementation("io.galva…:…:1.0.0")` when it ships. Full analysis in **§3.7**.

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
- Swift class `GalvaModule` (`@objc(GalvaModule)`) + a `.m` file with `RCT_EXTERN_REMAP_MODULE(Galva, GalvaModule, RCTEventEmitter)` / `RCT_EXTERN_METHOD`.
  > **Naming constraint (as-built, Phase 1):** the bridge class **cannot** be named `Galva` — the vendored core compiles into the *same* pod module and defines a public `enum Galva`. Hence class `GalvaModule`, remapped to the JS name `"Galva"`. Side benefit of sharing the module: the bridge calls the core directly (no `import Galva`) and can even read internal symbols (e.g. `SDKConstants.version` for `sdkVersion`).
- Events via `RCTEventEmitter` (native) ↔ `NativeEventEmitter` (JS) — single event `galva#message`.
- Why: codegen event-emitter needs RN ≥0.73 → conflicts with "lowest RN". Legacy is version-agnostic, works far back yet still reaches New Arch via interop.

### 3.3 Min deployment & Xcode floor
- iOS 15 / API 24 is the **OS floor** (also a StoreKit 2 requirement) — it does **not** reduce the RN version range (an app can always raise its target).
- **Xcode 26 is the consumer floor — accepted.** The pod compiles Galva's Swift-6 source, which references an iOS-26 SDK symbol (`compactJWS`) → the consumer's toolchain must be Xcode 26 (which bundles the iOS 26 SDK). This is **in sync with the native core** and is **not** something we engineer around (see the §0 decision record — A2 was the only dodge and it's both unproven and tricky).

### 3.4 iOS distribution: B — compile vendored source in the pod (PRIMARY)
We vendor Galva's Swift source into the package and let **CocoaPods compile it** alongside our bridge. Because CocoaPods' **default linkage is static**, the compiled core links straight into the app — **no `use_frameworks!`, Do Not Embed, zero Podfile edit**.

```ruby
# Galva.podspec — at the REPO ROOT (as-built, Phase 1).
# ⚠️ The podspec FILENAME must equal s.name: CocoaPods :path resolution looks for
# <s.name>.podspec — `galva-react-native.podspec` with s.name = 'Galva' silently
# fails autolinking (latent Phase-0 bug, found & fixed in Phase 1).
require 'json'
pkg  = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name          = 'Galva'
  s.version       = pkg['version']
  s.platforms     = { :ios => '15.0' }
  s.source        = { :git => 'https://github.com/Galva-io/galva-react-native.git', :tag => s.version.to_s }
  s.swift_version = '6.0'                       # Galva uses Swift 6 strict concurrency

  # Our bridge + the vendored Galva core — all compiled by the consumer (static by default).
  s.source_files = 'ios/bridge/**/*.{h,m,mm,swift}', 'ios/galva-src/Sources/**/*.swift'
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
- **Static by default** → no `use_frameworks!`, no embed, no Podfile edit. (A static *binary* would also achieve this, but only after a tricky static-xcframework build — see §3.5.)
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
- ⚠️ **Known script side effect (found Phase 1):** running the guard *locally* with a SHA rewrites the lock's `ref` field from the tag/`main` to that SHA (the script writes `ref` verbatim from `$1`). CI is unaffected (it only diffs `ios/galva-src`), but a local run can sneak a mutated `galva.lock.json` into a commit — `git checkout HEAD -- galva.lock.json` after, or improve the script to preserve `ref` when re-syncing the already-pinned commit.

**Tracking policy — TAG-first, MANUAL pin (decided 2026-06-04).**
galva-ios tags every release → we bump **to a release tag**, deliberately. Builds **never float `main`** — they always compile the `commit` recorded in `galva.lock.json`. Pulling new core code is a **human step**, never automatic:
1. `sync-galva.sh <release-tag>` (preferred) — or `sync-galva.sh` with no arg to take the latest tag automatically — or `main`/a specific SHA only while no tag exists yet.
2. Diff `Package.swift.ref` → if upstream changed `linkerSettings`/`swiftSettings` or added `resources:`, sync the podspec.
3. Build `example/` (New + Old Arch) → green.
4. Commit `ios/galva-src/Sources` + `galva.lock.json` in **one** commit.

> **No cron / no auto-PR bot** for now — kept simple. (A weekly "open-PR-if-main-moved" job is the obvious later add-on if drift-watching becomes a chore; explicitly out of scope this round.)

### 3.5 Future optimization — A2: ship a prebuilt static `Galva.xcframework` (NOT now)
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

### 3.6 Expo support (in scope — first-class)
`@galva/react-native` **must support Expo**. The strategy is the standard one for a native-module SDK: **dev-build only, autolinked, plus a config plugin** — and crucially **NOT** a rewrite into an Expo Module. Four decisions:

**(1) Expo Go is NOT supported — and that is the normal, expected state.**
Expo Go is a **prebuilt app** (shipped on the App/Play Store): `expo start` + Expo Go only loads your **JS bundle** into that pre-compiled shell — it never re-compiles native. So the native modules it knows are **frozen at the moment Expo built that binary** (the `expo-*` set + RN core). Our SDK carries **its own native code** — the ObjC/Swift bridge **and** the vendored Galva source (46 `.swift`, compiled in-pod). That code only exists *after* a native compile, so it is simply **absent** from the Expo Go binary; at runtime `NativeModules.Galva` resolves to `null` → `"native module doesn't exist"`. This is an **architectural limit, not a bug**, and it hits **every** native lib (Firebase, RevenueCat, …), not just Galva. You cannot inject new native code into an already-built app without rebuilding it.

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
- **iOS** (`withInfoPlist` / `withEntitlementsPlist` / deployment-target mod): bump iOS deployment target → 15.0; push entitlement + `UIBackgroundModes: [remote-notification]` (push token registration). *(rev 2: dropped the URL-scheme/associated-domains mod — the draft tied it to `handleDeepLink`, which the real core doesn't expose; deep-linking lives inside the core's IAM WebView. Revisit if the core grows a public deep-link entry.)*
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

### 3.7 Android distribution & wrapper — Maven AAR, NOT vendored source (the mirror-image of iOS)

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
- The **Expo Android config plugin (§3.6) shrinks**: `INTERNET` already comes from the AAR manifest → the plugin only needs `POST_NOTIFICATIONS` (Android 13+) + any deep-link intent-filter + the `minSdk 24` / `compileSdk 36` / Java-17 floor bump.

**Decision: transitive-dependency strategy — forward the core's constraints only; add no defensive layer yet.**
The wrapper does the minimum: `implementation` the AAR + `billing-ktx`, and **inherit whatever versions the core resolves**. We deliberately do **not** add `safeExtGet` overrides, a `galva-bom` import, or `resolutionStrategy.force` now. Rationale:
- **The core itself solves transitive conflicts only *internally*** — a Gradle **Version Catalog** (`gradle/libs.versions.toml`) pins all 10 modules to one coherent set (OkHttp `5.3.2`, coroutines `1.11.0`, Billing `8.0.0`…). But a Version Catalog is **build-time only — it does NOT travel into the published AAR**: consumers receive the *resolved* versions as ordinary transitive deps in the POM/`.module` metadata, and the host app's Gradle still runs "highest-version-wins" against them. The core ships **no BOM, no dependency constraints, no `force`** → it pushes consumer-side reconciliation entirely onto us.
- **Our stance (this round): mirror the core, don't second-guess it.** If/when the core publishes a BOM or constraints, the wrapper adopts them (e.g. `implementation(platform("io.galva…:galva-bom:<v>"))`) and tracks the core's versions verbatim. Until then we ship no override surface — fewer knobs to drift out of sync, and any real conflict in a host app is solved *there* (the app can always add its own `force`).
- **Upstream asks (logged, not blocking us):** (1) publish a **`galva-bom`**; (2) fix three build bugs found in the catalog — `kotlinx-serialization-*` pinned to the *coroutines* version ref (wrong version line), `lifecycle-process` using `version = "lifecycle"` (literal string, not `version.ref`), and **`mockwebserver` declared as `implementation` (not `testImplementation`) in `:network`** → a test lib leaking into the production AAR.

**The real near-term blocker — the core is unreleased (`-SNAPSHOT`).** Until a release tag + final coordinate land, in priority order:
1. **Stub the Android module** (API surface returns mocks) so JS + the example app keep building — exactly the existing Phase-2 plan, just now a *temporary* state, not a permanent "core doesn't exist."
2. For internal dev, consume via **GitHub Packages** (already configured; needs a token) or **`publishToMavenLocal`** (`mavenLocal()`).
3. Flip to the **Maven Central** coordinate the moment `io.galva*:…:1.0.0` ships; pin an exact version.

**API parity gap — iOS ↔ Android cores diverge. Decision: iOS is the canonical surface.**
When a method exists on one side but not the other, **iOS wins** — the RN TS surface (§6.2) is **iOS-shaped**, and Android is brought up to it (not the intersection).

> ⚠️ **rev 2:** the concrete method list that used to sit here was drawn from the *assumed* iOS surface and is void — most of those "iOS-only methods" (push-consent sextet, `handleDeepLink`, `deviceId`, `accountToken`, …) don't exist on the **real** iOS core either. The canonical surface is now the rewritten §6.2 (23 exports); the per-method Android bucketing is **reset, re-probe at Phase 2 entry** (§6.2 table). The *principle* stands unchanged:
- **iOS-backed methods missing on Android** stay in the surface — back them by the nearest core primitive where one exists (`setEmail`/`setDisplayName`/`setUserProperty` → `updateProperties(vararg ProfileProperty)`; email also via the `identify(email)` arg), and **stub the rest** (no-op or `rejectNotImplemented`) until the Android core grows them. Log each Android stub so the gap is visible, and file the missing methods as **upstream asks** on galva-android.
- **Android-only surface (`billing: BillingManager`)** is **surfaced to JS as an `@platform android` method** (§6.2) — backed by the core's `BillingManager` on Android, **stubbed/rejected on iOS** (Galva exposes no billing API there). It is the first and only Android-only member of the surface. (Purchases still execute via native StoreKit 2 / BillingClient — §1.)
- **IAM delivery differs but is hidden in the bridge**: Android = `getInAppMessage(): Flow<Message>` + `showMessage(activity, message)`; iOS = a `messages` emitter. The RN bridge maps the Android **Flow → a `NativeEventEmitter` event**, so the **JS surface stays identical** (`messages` emitter, iOS-shaped) on both.
- → **§6.2's TS surface is transcribed from iOS.** `parity-check.ts` (§7) diffs the surface against **both** cores, but treats an Android-missing method as a **known stub (tracked TODO), not a surface removal**; it flags only *iOS*-missing methods as real errors.

**IAM rendering on Android — reuse the core's own overlay, don't rebuild it:**
The Android core already ships the full WebView overlay — `FullScreenInAppMessageActivity` + `ScreenMessageOverlay` + a `JSBridge` (`@JavascriptInterface postMessage`) — and the content is a **downloaded, version-pinned WebView bundle** (`WebViewBundleResolver`/`Cache`/`Downloader`), i.e. a local bundle, **NOT** live-from-CDN. Its bridge protocol (`{name, requestId, payload}` envelope; methods `ready / dismiss / getPageContext / getMessageData / requestPurchase / openManageSubscription / openDeepLink / getProductPrice / showAlert / apiFetch`) is **core-internal** — the wrapper never builds an overlay or speaks this protocol on either platform (iOS verified Phase 1: the bridge just calls `try await message.show(in: scene)`; presentation, the version-pinned bundle, and protocol versioning — `bridgeProtocolMismatch` — are all inside the core). → On Android the RN wrapper **delegates to the SDK's built-in Activity overlay** (`showMessage`) rather than build a parallel transparent-Activity overlay in the RN layer.

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
| Android minSdk / compileSdk / Java | bump → 24 / 36 / 17 | 24 / 36 / 17 | core's floor (§3.7) |
| Galva Android core | **exists, unreleased** → **Maven AAR** (stub until `1.0.0`) | same | `io.galva…:galva-sdk` (coordinate TBD); no vendoring (§3.7) |
| **Expo** | dev build + `app.plugin.js` | dev build + `app.plugin.js` | **Expo Go unsupported**; EAS needs Xcode-26 image (§3.6) |

`package.json` (as-built, Phase 1):
```jsonc
"sideEffects": false,
"peerDependencies": { "react": "*", "react-native": "*" },
"galva": { "iosCoreRef": "main", "iosCoreCommit": "95c86a1cbfa1082608bb502eab4e6c9358a014a9" },  // mirrors galva.lock.json
"files": [
  "src", "lib",                       // lib = react-native-builder-bob output (ESM module + typescript)
  "android", "ios", "cpp", "*.podspec",  // podspec is at the REPO ROOT (Galva.podspec — §3.4)
  "galva.lock.json",                  // provenance of the vendored source
  "scripts", "react-native.config.js",
  "!ios/galva-src/Package.swift.ref", // settings-diff reference only — NOT shipped
  "!ios/build", "!android/build", /* …standard excludes… */
  // Phase 2.5 will add: "app.plugin.js", "plugin/build" (Expo config plugin — bare RN ignores it)
]
```
> Ships the vendored **source** (+ `LICENSE` for provenance; first-party code, no obligation). No floor is declared anywhere. The `respond_to?(:install_modules_dependencies)` guard and JS feature-detection are **graceful degradation**, not floor enforcement. peerDeps `*` reflects the primitive/version-agnostic stance.

---

## 5. Package structure

```
@galva/react-native/                  (as-built Phase 1; Expo plugin = Phase 2.5)
├─ src/
│  ├─ index.ts            # PUBLIC ENTRY — re-export ONLY (no logic), one line per api/* export
│  ├─ api/                # one named export per file (configure.ts, track.ts, show.ts, …) — 23 files, flat, tree-shakeable
│  ├─ types.ts            # shared types (GalvaConfig, InAppMessage, CommunicationPreference, …)
│  └─ NativeBridge.ts     # NativeModules + NativeEventEmitter wiring (internal, not re-exported)
├─ Galva.podspec          # AT REPO ROOT, filename = s.name (§3.4) — compiles bridge + galva-src (static by default)
├─ ios/
│  ├─ bridge/             # RN bridge — class GalvaModule, remapped to JS "Galva" (§3.2)
│  │  ├─ GalvaModule.swift
│  │  └─ GalvaModule.m    # RCT_EXTERN_REMAP_MODULE + RCT_EXTERN_METHOD ×23
│  └─ galva-src/          # VENDORED Galva source (sync-galva.sh @commit) — Sources/ + LICENSE shipped; Package.swift.ref not shipped
│                         # (no overlay file — the core ships its own presenter)
├─ galva.lock.json        # COMMITTED provenance: { source, ref, commit, treeSha256 }
├─ android/
│  ├─ src/main/java/com/galva/reactnative/GalvaModule.kt   # full-surface stub until the core ships (§3.7; log-once + defaults)
│  └─ build.gradle        # minSdk 24, conditional New Arch
├─ plugin/                # [Phase 2.5] Expo config plugin source (TS) — builds to app.plugin.js
├─ app.plugin.js          # [Phase 2.5] Expo plugin entry — consumer "plugins": ["@galva/react-native"]
├─ example/               # app testing both Old & New Arch (verified: RN 0.85 New Arch)
├─ scripts/
│  ├─ sync-galva.sh          # fetch galva-ios @ pinned commit → vendor into ios/galva-src + write galva.lock.json (public repo, no auth)
│  └─ parity-check.mts       # ✅ diffs JS surface ↔ iOS .m ↔ BOTH Android source sets; @platform escape hatch; runs in CI (lint job)
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
- **Emitters** (today just `messages` — the real core exposes a single message stream, §6.2) follow the **`@react-native-firebase` convention**: each is a **subscribe function that returns a plain `unsubscribe` function** —
  ```ts
  const unsubscribe = messages(msg => { /* … */ });
  // later
  unsubscribe();
  ```
  Not an object with `.remove()`, not `addListener/removeListener` — a bare callable, exactly like `onMessage`/`onAuthStateChanged` in RN Firebase.

### 6.2 The surface (1:1 with native) — **REWRITTEN 2026-06-11 against the REAL core**

> ⚠️ **The original list here was drafted against an *assumed* iOS core and diverged badly from reality.** Phase 1 transcribed the surface from the actual vendored facade (`Galva` / `AppEvents` / `AppUser` / `Communication` / `InAppMessages` in `ios/galva-src/Sources/Galva.swift`). Gone, because the core simply doesn't have them: `userId` (it's `identifiedUserId`), `accountToken`, the whole push-*consent* sextet (`setPushToken`/`clearPushToken`/`setPushConsent`/`setPushCategory`/`pushConsent`/`isPushCategoryEnabled` — replaced by per-platform `registerPushToken`/`unregisterPushToken` + `setCommunicationPreference`), `removeUserProperty`, `offerErrors`, `identityChanges`, `handleDeepLink`, `deviceId`, `setLogLevel` (logLevel is a `configure` option; the core's `setLogger(GalvaLogger)` takes a native object — not bridgeable, not surfaced). And the draft *missed* half of what the core does have (`track` — the entire `AppEvents` pillar! — opt-out, communication endpoints, …).

**The shipped surface — 23 flat exports (as built in `src/api/*`, one file each):**

- **Setup / global** — `configure({ apiKey, environment?, autoTrackLifecycle?, logLevel? })`, `setOptOut(enabled)`, `isOptedOut()`, `setDeviceToken(token)`, `reconcileTransactions()`, `sdkVersion()`
- **Events** — `track(eventName, attributes?)`
- **User** — `identify(userId, { appAccountToken? })` (token = UUID linking StoreKit purchases; JS validates format), `logout()`, `identifiedUserId()`, `isAnonymous()`, `setEmail(email)`, `setDisplayName(name)`, `setUserProperty(key, value)`
- **Communication endpoints** — `isValidEmail(email)`, `registerEmail(email)`, `unregisterEmail(email)`, `registerPushToken(token, platform?)`, `unregisterPushToken(token, platform?)` (platform: `'apns' | 'fcm'`), `setCommunicationPreference({ channel, disabled?, categories? })` (channel: `'email' | 'pushNotification' | 'inApp'`)
- **In-app messages** — `messages(listener)` (emitter → `unsubscribe`), `show(messageId)` (rejects with `NOT_CONFIGURED` / `MESSAGE_NOT_FOUND` / `BUNDLE_UNAVAILABLE` / `BRIDGE_PROTOCOL_MISMATCH` / `NO_ACTIVE_SCENE`), `checkForMessages()`

`billing` (**`@platform android`**, backed by the Android core's `BillingManager`, stubbed/rejected on iOS) remains the planned Android-only addition — Phase 2, not in the Phase-1 surface.

#### Android parity checklist — ✅ RE-PROBED 2026-06-11 (`identity-module` @ `641d052`, built & published to mavenLocal)

Facade changes since the 06-08 probe: the core **gained `setPushToken`/`clearPushToken`** (communication-endpoint ops). Coordinate **confirmed `io.galva.sdk:galva-sdk`** (verified by an actual `publishToMavenLocal`). Still **no event tracking at all** — `APIOperation` is identity + push endpoints only.

**A** = straight through · **B** = shimmed onto a different primitive · **C** = no backing → log-once gap (`@platform ios`) + upstream ask. As implemented in `android/src/core/kotlin/GalvaModule.kt`:

| iOS surface (real) | Bucket | Android backing (as wired) |
|---|---|---|
| `configure` | A | `Galva.configure(context, Configuration(apiKey, logLevel, autoTrackSessions, env))` — ⚠️ core's default env is **Development**; the bridge forces Production-by-default for iOS parity |
| `identify` | A | `identify(userId, email = null, obfuscatedAccountId = appAccountToken)` — ⚠️ StoreKit-token ↔ Play-id semantics = upstream question. ⚠️ Eventually consistent (verified on-device 2026-06-11): identify is queued through the core's event channel, so an immediate `identifiedUserId()`/`isAnonymous()` read returns the pre-identify snapshot — document for consumers |
| `logout` | A | `logout()` |
| `isAnonymous` | A | `isAnonymous` (guarded: unconfigured → `true`) |
| `messages` (emitter) | A | `getInAppMessage(): Flow<Message>` → collect → `galva#message` event. ⚠️ `Message` carries **only `id`** — `createdAt` stamped at receipt, `rawType` empty, `workflowType` absent (upstream ask) |
| `show` | A | registry lookup → `showMessage(currentActivity, message)`; same JS error codes as iOS (`MESSAGE_NOT_FOUND` / `NO_ACTIVE_SCENE`) |
| `registerPushToken` | A | `setPushToken(token)` — **new core API**; `platform: 'apns'` logged & ignored (FCM implied) |
| `identifiedUserId` | B | `currentUserId` — ⚠️ core falls back to `anonymousId`; bridge shims to iOS semantics (anonymous → `null`) |
| `unregisterPushToken` | B | `clearPushToken()` — clears the *current* token; the passed token isn't matched (upstream ask) |
| `setEmail` | B | `updateProperties(ProfileProperty.Email(email))` — ⚠️ Android key `"email"` vs iOS server key `"$gv_email"` (upstream normalization ask) |
| `setDisplayName` | B | `updateProperties(ProfileProperty.Custom("$gv_fullName", name))` — no typed trait on Android |
| `setUserProperty` | B | `updateProperties(ProfileProperty.Custom(key, value))` (string/number/bool, rest dropped — mirrors the iOS bridge) |
| `sdkVersion` | B | `io.galva.sdk.BuildConfig.SDK_VERSION` |
| `isValidEmail` | B | local regex in the bridge (no core API) |
| `checkForMessages` | B | deliberate no-op — Android IAM polls reactively on foreground |
| `track` | **C** | **no event-tracking API in the core at all** — the largest gap, top upstream ask |
| `setOptOut` / `isOptedOut` | **C** | no opt-out subsystem → gap (getter resolves `false`) |
| `setDeviceToken` | **C** | no separate device-token concept (the push endpoint is `registerPushToken`) → gap |
| `reconcileTransactions` | **C** | not exposed (billing reconciles internally) → gap |
| `registerEmail` / `unregisterEmail` | **C** | no email communication endpoints → gap |
| `setCommunicationPreference` | **C** | no preference API → gap |

**Tally: A 7 · B 8 · C 8** (of 23). `billing` (`@platform android`, D) unchanged — still deferred.

**Upstream asks for galva-android (re-filed against the real surface):** (1) **event tracking** (`track` — the biggest gap); (2) opt-out; (3) email communication endpoints + a preference API; (4) `reconcileTransactions`; (5) token-addressed push unregister; (6) `Message` metadata (`createdAt`/`rawType`/`workflowType`); (7) trait-key normalization (`"email"` vs `"$gv_email"`); (8) appAccountToken ↔ obfuscatedAccountId semantics; (9) **POM fixes**: `lifecycle-process` published with the literal version string `"lifecycle"` (unresolvable — the wrapper excludes + re-pins it), `androidx.test:core-ktx` leaking into every module's runtime scope, `mockwebserver` leaking from `:network`, coroutines `runtime`-scope despite being API surface (`getInAppMessage(): Flow`).

**Platform tagging — every platform-specific method is marked, not silently stubbed.** Any method the Android core turns out to lack gets **`@platform ios`**; `billing` gets **`@platform android`** — the symmetric case. Both stay exported on **both** platforms (so cross-platform call sites typecheck), carry a JSDoc `@platform …` tag + appear in the docs' platform-availability matrix, and on the **unsupported** platform they **no-op (void/emitter) or reject (`rejectNotImplemented` with the method name) + log once** — never a silent success. *(Interim state, as built: the Android module ships TWO source sets — `src/stub/kotlin` (full-surface log-once stub, the default) and `src/core/kotlin` (real wiring per the table above), toggled by `Galva_androidCore=true` + mavenLocal while the core is `1.0.0-SNAPSHOT`; the default flips when `1.0.0` ships, §3.7.)* `parity-check.ts` (§7) treats every `@platform ios` row as a **tracked TODO**, not a surface removal; it errors only when an iOS method is missing *and untagged*. When an upstream gap is filled, **drop the tag** — the tag's removal is the parity-restored signal.

---

## 7. Phased plan

### Phase 0 — Scaffold & spike — ✅ DONE (except the old-RN spike)
- ✅ `create-react-native-library`, strip the codegen spec, set up the legacy bridge.
- ✅ **Interop spike — DONE (2026-06-11), floor established:**
  - **RN 0.60: infeasible — no upstream-supported toolchain path.** Xcode 15 removed `std::unary_function` from libc++ → the boost vendored by old RN fails to compile ([facebook/react-native#37748](https://github.com/facebook/react-native/issues/37748)). The RN team backported the fix exactly to **0.72.5 / 0.71.13–14 / 0.70.14** — including a dedicated commit ["Make 0.70 compatible with Xcode 15"](https://github.com/facebook/react-native/commit/5bd1a4256e0f55bada2b3c277e1dc8aba67a57ce) — and **stopped at 0.70, never reaching 0.6x**. (Same pattern at the earlier break: the official Xcode 12.5 troubleshooting guide, [facebook/react-native#31480](https://github.com/facebook/react-native/issues/31480), covers only 0.61–0.64 — 0.60 has no supported path past Xcode 12.4.)
  - **RN 0.70.15 / Old Architecture: VERIFIED on BOTH platforms** (scratch consumer app + packed tarball). Android: build + emulator runtime smoke clean. iOS: builds under Xcode 26.5 and runs on simulator — **the vendored core answers through the legacy bridge** (`sdkVersion → 1.0.0`). Required **2 lib fixes** (shipped: podspec `min_ios_version_supported` floor-clamp + `install_modules_dependencies` guard; build.gradle legacy-RN path) and **6 documented consumer-side patches** (Node-22 metro/watchman workaround; minSdk 24 + platform 15.0 bumps; strip Yoga `-Werror`; drop the `__apply_Xcode_12_5_M1_post_install_workaround`; disable Flipper; add one empty `.swift` file to the ObjC-only app target so the Swift runtime links). → **Practical floor: RN 0.70 with patches; clean floor: 0.71+.**
- ✅ **Static-build cost audit (done):** `Package.swift` has `dependencies: []` + no `resources:` → podspec mapping is just `s.libraries = 'sqlite3'`.

### Phase 1 — iOS: vendored source + bridge — ✅ DONE & VERIFIED (2026-06-11)
- ✅ `scripts/sync-galva.sh` vendors Galva source **@ pinned commit** (`95c86a1`, ref `main` — no tags yet) + CI drift guard (`galva-src-drift` job). Public repo, **no auth**.
- ✅ B podspec (§3.4): `Galva.podspec` at repo root compiles `ios/bridge/**` + `ios/galva-src/Sources/**`, `sqlite3`, Swift 6, static. *(Found & fixed: podspec filename must equal `s.name`.)*
- ✅ Swift/ObjC bridge (`GalvaModule`, remapped to JS `"Galva"`) for the full **real** surface §6.2 — 23 methods; `NativeEventEmitter` for the single `messages` stream (`galva#message`). The draft's `offerErrors` / `identityChanges` emitters don't exist in the core — dropped.
- ✅ Example app runs on RN 0.85 New Arch — **zero Podfile edit** confirmed (autolinking), clean build links statically (`libGalva.a` = `ar archive`, no `use_frameworks!`), Xcode 26.5 / Swift 6 strict concurrency green.

### Phase 2 — Android (core exists, unreleased — §3.7) — 🚧 IN PROGRESS (started 2026-06-11)
- ✅ Stub module (full surface, log-once) — now `src/stub/kotlin`, the **default** source set.
- ✅ **Re-probe** `identity-module` @ `641d052` against the real 23-export surface → §6.2 table rebuilt (A 7 · B 8 · C 8). Coordinate confirmed `io.galva.sdk:galva-sdk`.
- ✅ **Real wiring** in `src/core/kotlin/GalvaModule.kt`, toggled by `Galva_androidCore=true` (+ optional `Galva_androidCoreVersion`, default `1.0.0-SNAPSHOT`): `implementation("io.galva.sdk:galva-sdk")` + `billing-ktx:8.0.0` (core declares Play Billing `compileOnly`) + explicit `kotlinx-coroutines-android:1.11.0` (runtime-scope in the POM but API surface). **POM workarounds:** exclude `lifecycle-process` (broken literal version `"lifecycle"`) → re-pin `2.8.7`; exclude leaked test libs (`androidx.test`, `mockwebserver`). **No source vendoring** — Gradle resolves the AAR graph; autolinking wires the module.
- ✅ **IAM delegated to the core** — `getInAppMessage(): Flow<Message>` → collect → `galva#message` event + id-registry; `show` → `showMessage(currentActivity, message)`. No wrapper overlay.
- ✅ Interim consumption verified: core built & **published to mavenLocal** (needs the leaked signing props stripped or `-x signMavenPublication` — they don't sign). Both source sets compile against RN 0.85 / Kotlin 2.1.20 (core AAR is Kotlin 2.2 — consumers need Kotlin ≥ 2.1).
- ✅ **Runtime smoke-test on emulator** (2026-06-11, Pixel 3a API 32, core flavor): app boots, `configure` spins the core up (operation queue, identity created, API calls fire & handle the fake-key 500 gracefully), `sdkVersion` round-trips `1.0.0-SNAPSHOT` to the UI, `track` gap-logs once, identify processes (`userId=example_user_1` in identity state), IAM polling + Flow collector active, **no crash**. Found: identify is eventually consistent (see the §6.2 table caveat).
- ⏳ Remaining: flip the toggle default + pin an exact version when `1.0.0` ships on Maven Central; file the §6.2 upstream asks on galva-android; settle `billing` (`@platform android`).
- Floor: compileSdk 36 / minSdk 24 / Java 17.

### Phase 2.5 — Expo config plugin — ✅ DONE & VERIFIED (2026-06-11)
- ✅ `plugin/src/index.ts` (built by `tsc -p plugin` in `prepare`) → `app.plugin.js`; shipped via `files` (`app.plugin.js`, `plugin/build`). One option: `{ push?: boolean }` (default `true`). Wrapped in `createRunOncePlugin`.
- ✅ Mods (raise-only — never lowers an existing value): iOS `ios.deploymentTarget` → 15.0 (Podfile properties), `aps-environment` entitlement, `UIBackgroundModes += remote-notification` (Set — no dupes); Android `android.minSdkVersion` → 24 (only when explicitly pinned lower; absent = template default ≥ 24), `POST_NOTIFICATIONS` permission. *(rev 2: URL-scheme/deep-link mods dropped — the real core has no deep-link API, §3.6; INTERNET comes from the AAR manifest, §3.7.)*
- ✅ **Verified against a real prebuild** (scratch `create-expo-app` + the packed tarball + `"plugins": ["@galva/react-native"]` + `npx expo prebuild`): all 5 injections present in the generated projects, and a second prebuild run produces no duplicates (idempotent). `npm pack` confirmed the plugin ships.
- ⏳ Remaining (folded into Phase 3 hardening): full Expo **dev-client build/run** (pod autolinking already proven on the bare example, Phase 1); document the `expo-dev-client`/prebuild/EAS path in docs beyond the README row.

### Phase 3 — Hardening — 🚧 IN PROGRESS (started 2026-06-12)
- ✅ `scripts/parity-check.mts` in CI (lint job): enforces barrel ↔ `api/*` 1:1, JS native-interface ↔ iOS `RCT_EXTERN_METHOD`, and parity across BOTH Android source sets (stub/core — nothing else catches that drift); missing methods need an `@platform` tag or the build fails. Negative-tested.
- ✅ CI live on `develop` (2026-06-12): all 5 jobs green — incl. build-ios compiling the vendored Swift 6 core on the runner (first independent verification off the dev machine). Fixed: workflow only triggered on `main`; `packageManager` field (required by turbo 2.x) lost in the yarn→npm migration.
- ✅ Integration guides in `docs/` (shipped in the npm package, linked from README): push-notifications (setDeviceToken vs registerPushToken, bare iOS/Android + Expo flows), expo (dev-build, plugin injections/options, EAS), legacy-react-native (0.71+ as-is / 0.70 patch list / ≤0.6x impossible with sources). identify/identifiedUserId TSDoc now documents eventual consistency.
- ⏳ Remaining: release pipeline (npm publish workflow, CHANGELOG/semver — sensibly gated on galva-ios's first release tag).

---

## 8. CI matrix

> **Verified-by-hand matrix (2026-06-11, scratch consumer apps + packed tarball — the apps are committed under [`examples-compat/`](examples-compat/README.md), standalone & outside npm workspaces by design):**
>
> | Consumer | Arch | Android | iOS |
> |---|---|---|---|
> | Bare RN 0.85 (`example/`) | New | ✅ build + dev-bundle runtime (stub & core flavor) | ✅ build + dev-bundle runtime (Phase 1) |
> | Bare RN 0.70.15 | **Old** | ✅ build + dev-bundle runtime | ✅ build + dev-bundle runtime (6 consumer patches — §7 Phase 0) |
> | Expo SDK 56 + config plugin | New (`fabric:true`) | ✅ build + dev-bundle runtime | ✅ build + dev-bundle runtime |
> | Expo SDK 54 + config plugin | **Old** ("Legacy Architecture" log) | ✅ build + dev-bundle runtime | ✅ build + dev-bundle runtime (local fmt plugin — examples-compat README) |
> | RN 0.60 | Old | ❌ infeasible (toolchain-level, §7 Phase 0) | ❌ infeasible |

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
| `Galva`-module-vs-`Galva`-type name collision | Low | Only bit the `.swiftinterface` *verifier* under distribution builds — **B never emits a distributable interface**, so it doesn't apply. **It DOES constrain bridge naming** (hit in Phase 1): the bridge class can't be named `Galva` (core's public enum, same module) → class `GalvaModule` + `RCT_EXTERN_REMAP_MODULE` to JS `"Galva"` (§3.2) |
| Interop not solid on old RN (0.68–0.70) | Medium | Phase 0 spike; document the empirically-working marks (don't turn them into a floor) |
| Android core **unreleased** (`1.0.0-SNAPSHOT`) + coordinate unsettled | Medium | Core **exists** & is publish-wired (§3.7). Stub now; flip to the Maven AAR on release. Interim: GitHub Packages / `mavenLocal`. Mirror-image of iOS — no vendoring |
| iOS↔Android API parity gap (push/email/deeplink absent on Android; billing Android-only) | Medium | **iOS canonical** — iOS-only methods tagged `@platform ios`, stubbed on Android (`updateProperties`/`identify` where possible, else not-implemented + log); `billing` tagged `@platform android`, stubbed on iOS. `parity-check` flags only iOS-missing-untagged as errors (§3.7/§6.2) |
| galva-android public repo leaks live publishing secrets | **High (their repo, not RN)** | Out-of-band: rotate Sonatype token + GPG key, purge git history, move to env/`~/.gradle` (§3.7). Blocks any Android release until fixed |
| RN below autolinking must link manually | Low | Document manual-link instructions; doesn't block, no floor set |
| Source compile cost grows if the core balloons | Low (watch) | Trigger to revisit **A2** (§3.5) if build time becomes painful |
| ~~EAS Build lacks an Xcode-26 image~~ | **None (verified 2026-06-05)** | EAS **default image already = Xcode 26.4**; `auto` alias picks it; Apple mandates Xcode 26 for App Store uploads from 2026-04-28 → our floor matches the EAS default. Only edge: consumer pinning an old `image` → drop the pin (§3.6) |
| Expo users expect Expo Go to work | Low | Document up front: native lib → **dev build required** (normal for Firebase/RevenueCat too); managed workflow preserved, only the run target changes (§3.6) |

---

## 10. Open questions

- ✅ ~~Dual-mode vs source-only / A2 vs B~~ → **B (compile vendored source) is PRIMARY**; A2 (ship static binary) demoted to a future optimization (§3.5). *(decided 2026-06-04 — see §0 decision record)*
- ✅ ~~License to ship source~~ → **N/A: `galva-ios` is first-party (our own repo)** → no license/IP constraint at all.
- ✅ ~~`resources` / transitive deps~~ → audited: `dependencies: []`, no `resources:`, only `sqlite3`.
- ✅ ~~Where to pin (tag vs commit)~~ → **by release TAG** (galva-ios tags each release); fall back to `main` only while no tag exists. Lock records `ref` + resolved `commit`. **Validated:** anonymous `git fetch --depth 1 origin <tag|branch|sha>` + `Sources/` self-contained (system frameworks + system `SQLite3` only, 0 transitive Swift deps).
- ✅ ~~How to track upstream~~ → **tag-first, manual pin** (no cron/auto-PR); builds never float `main` (§3.4.1).
- ✅ ~~Consumer Xcode floor~~ → **26+, accepted** (incl. old RN — assumed accepted).
- ✅ ~~Emitter API shape~~ → **Firebase convention**: subscribe fn returning a plain `unsubscribe()`.
- ✅ ~~Old project Old vs New Arch~~ → **irrelevant**; the lib supports **both** by design.
- ✅ ~~Android scope~~ → **iOS-first; Android stub this round.** But the core **exists** (`identity-module` = full multi-module SDK, `1.0.0-SNAPSHOT`) → Android = **consume the Maven AAR, no vendoring** (mirror-image of iOS, §3.7). Open follow-ups: final **coordinate** (`io.galva.sdk:galva-sdk` vs `io.galva:sdk`), **release** of `1.0.0`, **API-parity** (decided: **iOS canonical** — stub iOS-only methods on Android until the core catches up), **deps** (decided: forward the core's constraints only, no defensive layer; ask upstream for a BOM + fix 3 catalog bugs), and the upstream **secret-leak** rotation.
- ✅ ~~Expo support~~ → **first-class via dev build + `app.plugin.js`** (§3.6). Expo Go unsupported (custom native); **no** Expo Module rewrite; **no** `expo` peerDep (bare RN untouched). Risk = EAS Xcode-26 image.

**→ No open blocking questions remain. Phase 0/1 DONE (2026-06-11); next up: Phase 2 (Android, blocked on core release — stub shipped), Phase 2.5 (Expo plugin), Phase 3 (parity-check + docs), plus the pending old-RN interop spike (§7 Phase 0).**

---

## 11. Appendix — distribution per docs
- iOS: SPM `github.com/Galva-io/galva-ios` (first-party, public) + (their future, **dynamic**) `Galva.xcframework`. **Not** on CocoaPods trunk. We compile the **vendored source** in our own podspec.
- Android: Maven AAR — coordinate **TBD** (`io.galva.sdk:galva-sdk` per `gradle.properties` vs `io.galva:sdk` per README), **`1.0.0-SNAPSHOT`, not yet released**. Multi-module Gradle SDK, vanniktech-published to Maven Central + GitHub Packages. RN wrapper `implementation`s it (no vendoring) — §3.7.
- RN: npm `@galva/react-native` — bare RN **and** Expo (dev build + bundled `app.plugin.js`; not Expo Go).
- Flutter: `galva_flutter`.
