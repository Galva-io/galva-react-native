# `@galva/react-native` — Architecture & Build Plan

> rev 3 · 2026-06-12 · Owner: thaitd
> Goal: wrap the Galva Client SDK for React Native — one package for old & new projects, lowest possible RN footprint.
>
> **Status: Phases 0–3 done.** iOS fully working (vendored core compiled in-pod), Android stub by default + real wiring behind a dev toggle, Expo config plugin, compatibility matrix verified on-device, CI green (5 jobs + parity check), release pipeline ready. Everything still open is listed in [§8](#8-remaining-work--gates).

## 1. What this is

Galva is a subscription-**retention** platform; its client SDK is thin: identity mapping, event tracking, in-app message display, push/email endpoints, session tracking. Purchases always execute via native StoreKit 2 / BillingClient — iOS exposes **no billing API to JS**; the Android core has a `BillingManager` that will become the surface's only `@platform android` member later.

Consumers to serve: **habitify-rn** (RN 0.85, New Architecture) and an older bare-RN app — plus Expo apps. Both architectures, one package.

## 2. Ground truth — the two native cores

| | iOS — `Galva-io/galva-ios` | Android — `Galva-io/galva-android` |
|---|---|---|
| Status | First-party, public, SPM-only, **no release tags yet** (we pin a `main` commit) | First-party, complete multi-module SDK on branch `identity-module` — **unreleased** (`1.0.0-SNAPSHOT`) |
| Tech | Swift 6 strict concurrency, **requires Xcode 26** (uses an iOS 26 SDK symbol, back-deployed to iOS 15) | Kotlin 2.2 AAR, AGP 9 / Gradle 9.1 / JDK 17, compileSdk 36 / minSdk 24 |
| Deps | None — `Sources/` is self-contained (system frameworks + system `SQLite3` only) | kotlinx, OkHttp 5, androidx, Play Billing 8 (**compileOnly**), GMS ads-id — Gradle resolves them |
| Distribution to us | **Vendor the source, compile in the pod** (§3.2) | **Maven AAR** — coordinate confirmed `io.galva.sdk:galva-sdk` (§3.6) |
| Facade | `Galva` / `AppEvents` / `AppUser` / `Communication` / `InAppMessages` | `io.galva.sdk.Galva` singleton — **no event-tracking API yet** (biggest parity gap, §4) |

⚠️ **Security (urgent, upstream):** galva-android's `gradle.properties` commits live publishing secrets (Sonatype credentials + GPG private key) to a public repo. Rotate keys + purge git history **before any Android release**.

## 3. Decisions

### 3.1 One package, legacy bridge, no RN floor

- Native module = legacy `RCTBridgeModule`/`RCTEventEmitter` (**no codegen/TurboModule spec**): runs natively on the Old Architecture and via RN's interop layer on the New one. Precedent: reanimated/svg/gesture-handler are all one package.
- **No RN version floor declared** (`peerDependencies: react/react-native: "*"`). The *practical* floor comes from the consumer's own toolchain — measured in §6.
- Swift bridge class is **`GalvaModule`**, remapped to JS name `"Galva"` via `RCT_EXTERN_REMAP_MODULE`: the vendored core compiles into the *same pod module* and owns the public `Galva` type. Sharing the module also lets the bridge call the core without `import Galva` (it even reads the internal `SDKConstants.version` for `sdkVersion()`).

### 3.2 iOS distribution — compile the vendored source in the pod ("Mode B")

We vendor the core's Swift source into `ios/galva-src/` and let CocoaPods compile it together with the bridge. CocoaPods links **static by default** → no `use_frameworks!`, Do-Not-Embed, **zero Podfile edit**; autolinking does the rest.

Why this beats shipping a prebuilt xcframework ("A2", kept as a future option):
- The core is **first-party and small** (46 files / ~10.4k LOC → tens of seconds clean, ~0 incremental); no license/IP concern, no real build-time pain.
- A2's build is genuinely tricky (static product archives to a bare `.o`; `MACH_O_TYPE` fights; swiftinterface verifier hits the `Galva`-module-vs-`Galva`-type collision) **and buys nothing**: the bridge compiles consumer-side either way, so the consumer Xcode floor is ~26 in both paths.
- Revisit A2 only if the core balloons or upstream cuts a *static* binary release (their current release script produces a dynamic one).

**Podspec facts (each one was a real bug once):** the podspec lives at the repo root and **must be named `Galva.podspec`** (CocoaPods resolves `<s.name>.podspec`); platform floor is `max(min_ios_version_supported, 15.0)` — RN 0.70's helper returns 12.4 and would drag the pod below StoreKit 2; `install_modules_dependencies` is guarded with `respond_to?` (fallback `s.dependency "React-Core"` for RN ≤ 0.70); `s.libraries = "sqlite3"`, `s.frameworks = "StoreKit", "WebKit"`, `swift_version 6.0`.

### 3.3 Vendoring & sync policy

npm doesn't check out git submodules → the core must be **real committed files**, shipped in the npm `files` map. `scripts/sync-galva.sh [<ref>]` fetches galva-ios shallowly (tag preferred; `main` while no tag exists), copies `Sources/` + `LICENSE`, keeps `Package.swift.ref` (not shipped) for settings-diff, and writes **`galva.lock.json`** `{source, ref, commit, treeSha256}` — `commit` is the reproducible pin.

- **Tag-first, manual pin.** Builds never float `main`; bumping the core is a deliberate human step (sync → diff `Package.swift.ref` → build example → one commit). No auto-PR bot.
- **CI drift guard** (`galva-src-drift` job): re-runs the sync at the pinned commit and `git diff --exit-code ios/galva-src` — hand-edits fail the build.
- Known script wart: re-running locally with a SHA rewrites the lock's `ref` field — restore it or improve the script.

### 3.4 In-app messages — both cores ship their own presenter

The wrapper builds **no overlay** and never speaks the WebView↔native protocol. iOS: bridge resolves the foreground scene and calls `try await message.show(in: scene)` (presentation, version-pinned WebView bundle, protocol versioning all core-internal — `bridgeProtocolMismatch` surfaces as a mapped reject code). Android: delegate to the core's `showMessage(activity, message)`. The wrapper's whole IAM job: map the core's message stream → `galva#message` event + keep an id registry so JS can `show(id)`.

### 3.5 Expo — dev build + config plugin, no Expo Module rewrite

- **Expo Go unsupported** (prebuilt shell can't contain our native code) — normal for any native SDK. Managed/CNG users are fine: they build a **dev client** once (`expo-dev-client` + `expo run:*`/EAS) and keep config-driven projects + hot reload.
- Keep the legacy bridge — Expo runs RN community autolinking at prebuild. Rewriting on `expo-modules-core` would force that dep on every bare consumer. Rejected.
- **`app.plugin.js`** (source `plugin/src`, built by `prepare`; `exports` must include `"./app.plugin.js"` — Expo SDK 54's resolver needs it). Injects idempotently, **raise-only** (never lowers/creates values the template already satisfies): iOS `aps-environment` + `UIBackgroundModes += remote-notification` + deployment-target floor 15.0; Android `POST_NOTIFICATIONS` + minSdk floor 24. Option `{ push: false }` skips the push items. `INTERNET` comes from the Android AAR's own manifest. No `expo` peerDep — bare RN never reads the plugin.
- EAS: default image already runs Xcode 26 (Apple mandates it for App Store uploads since 2026-04-28) — no special config.

### 3.6 Android — Maven AAR behind a source-set toggle (mirror-image of iOS)

No vendoring, no NDK: depend on the published AAR and let Gradle resolve the graph. Because the core is unreleased, the module ships **two source sets** selected by the `Galva_androidCore` Gradle property:

- **`src/stub/kotlin` (default):** full-surface stub — void calls no-op with a one-time log, getters resolve safe defaults, `show` rejects. Consumers build with zero extra setup.
- **`src/core/kotlin` (dev, `-PGalva_androidCore=true`):** real wiring against `io.galva.sdk:galva-sdk:1.0.0-SNAPSHOT` from mavenLocal (`publishToMavenLocal` in galva-android — strip the leaked `signingInMemory*` props first or signing fails). Verified end-to-end on emulator.

POM workarounds the wrapper carries (filed as upstream asks): exclude `androidx.lifecycle:lifecycle-process` (published with the literal version string `"lifecycle"`) and re-pin it; exclude leaked test libs (`androidx.test`, `mockwebserver`); add `kotlinx-coroutines-android` explicitly (runtime-scope in the POM but part of the compile API — `getInAppMessage(): Flow`); add `billing-ktx` (core declares Play Billing `compileOnly`). Dependency stance: **forward the core's constraints only** — no BOM/`force` layer until upstream publishes one. Consumers need **Kotlin ≥ 2.1** (the AAR is Kotlin 2.2).

Legacy-RN support in `android/build.gradle`: RN < 0.71 has no `com.facebook.react` Gradle plugin and no `react-android` artifact → version detection (walk-up to `node_modules/react-native/package.json`) switches to the era wiring (`react-native:+`, manifest-package instead of `namespace` for AGP < 7.3 via `src/legacy/AndroidManifest.xml`).

**When `1.0.0` ships on Maven Central:** flip the toggle default, pin the exact version, drop mavenLocal, re-verify, settle the `billing` surface.

## 4. API surface — 23 flat exports, iOS-canonical

Style (plan-locked): **flat named exports** (lodash-es style), one function per `src/api/*` file, re-exported by the single sanctioned barrel `src/index.ts` (re-export only, `sideEffects: false`); no default export, no namespace object; emitters are Firebase-style subscribe functions returning `unsubscribe()`.

The surface is transcribed 1:1 from the **real** iOS facade:

- **Setup/global** — `configure({apiKey, environment?, autoTrackLifecycle?, logLevel?})`, `setOptOut`, `isOptedOut`, `setDeviceToken`, `reconcileTransactions`, `sdkVersion`
- **Events** — `track(name, attributes?)`
- **User** — `identify(userId, {appAccountToken?})`, `logout`, `identifiedUserId`, `isAnonymous`, `setEmail`, `setDisplayName`, `setUserProperty`
- **Communication** — `isValidEmail`, `registerEmail`, `unregisterEmail`, `registerPushToken(token, 'apns'|'fcm')`, `unregisterPushToken`, `setCommunicationPreference({channel, disabled?, categories?})`
- **In-app messages** — `messages(listener)` (emitter), `show(messageId)` (rejects `NOT_CONFIGURED`/`MESSAGE_NOT_FOUND`/`BUNDLE_UNAVAILABLE`/`BRIDGE_PROTOCOL_MISMATCH`/`NO_ACTIVE_SCENE`), `checkForMessages`

Behavioral notes: all write APIs are fire-and-forget (native core queues + persists in SQLite, retries uploads); **`identify` is eventually consistent** on both platforms — an immediate `identifiedUserId()`/`isAnonymous()` read can return the previous state (verified on-device).

### Android backing (probed `identity-module` @ `641d052`, as wired in `src/core/kotlin`)

| Bucket | Methods | Notes |
|---|---|---|
| **A** — direct | `configure`, `identify`, `logout`, `isAnonymous`, `messages`, `show`, `registerPushToken` | configure forces env default to Production (core's default is Development); `appAccountToken` → `obfuscatedAccountId` (semantics = upstream question); `Message` carries only `id` → `createdAt` stamped at receipt, `rawType`/`workflowType` empty |
| **B** — shimmed | `identifiedUserId` (core falls back to anonymousId → bridge returns `null` when anonymous), `unregisterPushToken` (core clears *current* token only), `setEmail`/`setDisplayName`/`setUserProperty` (→ `updateProperties(ProfileProperty…)`; trait-key conventions diverge: Android `"email"` vs iOS `"$gv_email"`), `sdkVersion` (BuildConfig), `isValidEmail` (local regex), `checkForMessages` (no-op — Android IAM is a reactive Flow) |
| **C** — no backing (log-once gap) | **`track`** (core has NO event API — top ask), `setOptOut`/`isOptedOut`, `setDeviceToken`, `reconcileTransactions`, `registerEmail`/`unregisterEmail`, `setCommunicationPreference` |

Rule: iOS is canonical; Android-missing methods stay in the surface as logged stubs. A method missing on a platform must carry a JSDoc **`@platform`** tag or `parity-check` fails the build. `billing` (`@platform android`, backed by the core's `BillingManager`, rejected on iOS) is the planned first Android-only member — deferred until core integration.

**Upstream asks for galva-android:** event tracking; opt-out; email endpoints + preference API; `reconcileTransactions`; token-addressed push unregister; `Message` metadata; trait-key normalization; appAccountToken semantics; POM fixes (lifecycle-process version, test-lib leaks, coroutines scope); publish a BOM.

## 5. Repo layout

```
src/index.ts          # the one sanctioned barrel — re-export only
src/api/*             # 23 files, one export each (tree-shakeable)
src/NativeBridge.ts   # NativeModules + emitter wiring (internal)
Galva.podspec         # repo ROOT, filename = s.name (§3.2)
ios/bridge/           # GalvaModule.swift + .m (RCT_EXTERN_REMAP_MODULE)
ios/galva-src/        # VENDORED core (sync-galva.sh) + galva.lock.json at root
android/src/{main,stub,core,legacy}/   # package + stub/core toggle + AGP<7.3 manifest
plugin/ + app.plugin.js                # Expo config plugin
scripts/{sync-galva.sh, parity-check.mts}
docs/{push-notifications, expo, legacy-react-native}.md
example/              # RN 0.85 dev app (workspace, CI-built)
examples-compat/      # frozen consumer apps: rn070-oldarch, expo54-oldarch, expo56-newarch
                      #   (standalone, install the lib from a packed tarball — see its README)
```

## 6. Compatibility — verified matrix (2026-06-11, build + dev-bundle runtime on device/simulator)

| Consumer | Arch | Android | iOS |
|---|---|---|---|
| Bare RN 0.85 (`example/`) | New | ✅ (stub & core flavor) | ✅ |
| Bare RN 0.70.15 | **Old** | ✅ | ✅ (6 consumer patches — `docs/legacy-react-native.md`) |
| Expo SDK 56 + plugin | New (`fabric:true`) | ✅ | ✅ |
| Expo SDK 54 + plugin | **Old** | ✅ | ✅ (local fmt-vs-Xcode-26 plugin — `examples-compat/README.md`) |
| RN 0.60 | Old | ❌ | ❌ |

**Floor: 0.71+ works as-is; 0.70 with documented patches; ≤ 0.6x is unbuildable on a 2026 toolchain** — independent of Galva: RN's toolchain fixes were only ever backported to 0.70 ([Xcode 15 fix](https://github.com/facebook/react-native/commit/5bd1a4256e0f55bada2b3c277e1dc8aba67a57ce), [#37748](https://github.com/facebook/react-native/issues/37748)); the [Xcode 12.5 guide](https://github.com/facebook/react-native/issues/31480) covers only 0.61–0.64. The on-iOS proof that the whole chain works on Old Arch: RN 0.70 simulator runtime returns the real core's `sdkVersion: 1.0.0` over the legacy bridge.

## 7. CI & release

**CI** (push/PR on `main` + `develop`): `lint` (ESLint + **parity-check** — barrel↔api 1:1, JS interface ↔ iOS `RCT_EXTERN_METHOD`, ↔ *both* Android source sets, `@platform` escape hatch) · `build-library` (bob + plugin tsc) · `galva-src-drift` (§3.3) · `build-android` / `build-ios` (example app; the iOS job compiles the vendored Swift 6 core under Xcode 26 on the runner). `examples-compat` apps are verified by hand, not in CI (cost).

**Release** (`release-it` + the manual **Release** workflow): quality gates → version bump → tag `vX.Y.Z` → GitHub release (auto notes) → `npm publish --provenance` (scoped, access public; rebuilds via `prepare`). `CHANGELOG.md` is keep-a-changelog, updated by hand. Details in `CONTRIBUTING.md`.

## 8. Remaining work / gates

| Item | Blocked on |
|---|---|
| Add `NPM_TOKEN` repo secret (publish rights for `@galva`) | npm org access (manual, one-time) |
| **First publish `0.1.0`**: re-pin the core by tag (`sync-galva.sh <tag>`) → Release workflow with exact version `0.1.0` | galva-ios's first release tag |
| Flip `Galva_androidCore` default, pin version, drop mavenLocal, re-verify; settle `billing` | galva-android `1.0.0` on Maven Central |
| File the §4 upstream asks as galva-android issues | — (just do it) |
| Rotate galva-android's leaked publishing secrets | upstream team — **blocks any Android release** |
| Optional: dedicated `expo-dev-client` flow test; weekly core-drift watch job | nice-to-have |

## 9. Risks (current)

| Risk | Level | Mitigation |
|---|---|---|
| Consumer must compile the core + use Xcode 26 | Accepted | In sync with the native core; ~10k LOC ≈ tens of seconds; a prebuilt binary couldn't dodge the floor anyway (§3.2) |
| `Package.swift` settings drift on core bumps | Low | `Package.swift.ref` diff + CI drift guard; manifest audited trivial (`dependencies: []`, sqlite3 only) |
| Android core API/POM churn before `1.0.0` | Medium | Stub is the default; core wiring re-probed at integration; parity-check + `@platform` keep the surface honest |
| iOS↔Android parity gap (no `track`, …) | Medium | iOS-canonical + logged stubs + upstream asks (§4) |
| Upstream secret leak (galva-android) | High (theirs) | Rotation tracked in §8 — blocks Android release |
| Source-compile cost grows | Low (watch) | Trigger to revisit the prebuilt-binary option (§3.2) |
