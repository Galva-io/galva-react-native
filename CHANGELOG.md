# Changelog

Notable changes to `@galva/react-native`. Maintained by hand
([keep a changelog](https://keepachangelog.com)); release automation
(`npm run release` / the Release workflow) handles versioning, tags, GitHub
releases and npm publishing — update this file as part of the release PR.

## [Unreleased]

### Added

- Full iOS support (plan Mode B): the first-party Galva iOS core is vendored
  (`ios/galva-src`, pinned via `galva.lock.json`) and compiled inside the
  CocoaPods pod — static linkage, no `use_frameworks!`, zero Podfile edits.
- Legacy-bridge native module (`RCT_EXTERN_REMAP_MODULE`): one package for the
  Old and New Architecture, no React Native version floor declared. Verified
  on RN 0.70 (Old Arch, with documented consumer patches), RN 0.85 (New Arch),
  Expo SDK 54 (Old Arch) and SDK 56 (New Arch) — see `examples-compat/`.
- Flat, tree-shakeable API surface (23 named exports): configure, track,
  identity (identify/logout/identifiedUserId/isAnonymous), user traits,
  communication endpoints (email + push tokens, preferences) and in-app
  messages (`messages` emitter + `show`).
- Android module with two source sets: full-surface stub (default, the
  Android core is unreleased) and real core wiring behind the
  `Galva_androidCore=true` Gradle property.
- Expo config plugin (`app.plugin.js`): push entitlement,
  `UIBackgroundModes: [remote-notification]`, `POST_NOTIFICATIONS`,
  raise-only deployment-target/minSdk floors; `{ push: false }` opt-out.
- Integration guides (`docs/`): push notifications, Expo, legacy React Native.
- CI: lint + parity-check (JS surface ↔ all native bridges), library build,
  vendored-source drift guard, Android & iOS example builds.
