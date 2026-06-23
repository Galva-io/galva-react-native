#!/usr/bin/env bash
#
# scripts/test-autowire-e2e.sh
#
# Real-world E2E for the push auto-wiring swizzler (npm run test:ios:e2e).
#
# Unlike the deterministic unit tests (scripts/test-autowire.sh — a logic bundle
# with synthetic classes and a stub), this runs the swizzler INSIDE the real
# example app, through the real application lifecycle, against the REAL Galva pod,
# alongside a live competitor swizzler that hooks the same delegate methods the
# way OneSignal / Firebase Messaging do. See example/ios/GalvaExampleTests.
#
# Steps: ensure the app-hosted test target exists (idempotent) → pod install →
# xcodebuild test the GalvaExampleTests bundle on a simulator.
#
# Requires: Xcode 26+ (the Galva core's toolchain), CocoaPods, and a built
# example workspace (npm ci at the repo root installs example deps + links the
# local package).
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export DEVELOPER_DIR="${DEVELOPER_DIR:-$(xcode-select -p)}"
# CocoaPods needs a UTF-8 locale or `pod install` aborts on non-ASCII paths.
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

echo "==> Ensuring GalvaExampleTests target exists"
ruby "$ROOT/scripts/gen-e2e-target.rb"

echo "==> pod install (example/ios)"
( cd "$ROOT/example/ios" && pod install )

UDID="$(xcrun simctl list devices available | grep -E 'iPhone' \
  | grep -oE '[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}' | head -1)"
[ -n "$UDID" ] || { echo "error: no iPhone simulator available" >&2; exit 2; }
echo "==> Running E2E on simulator $UDID"

xcodebuild test \
  -workspace "$ROOT/example/ios/GalvaExample.xcworkspace" \
  -scheme GalvaExample \
  -only-testing:GalvaExampleTests \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination "platform=iOS Simulator,id=$UDID" \
  CODE_SIGNING_ALLOWED=NO
