#!/usr/bin/env bash
#
# test-expo-runtime.sh  (npm run test:expo:runtime)  — L2 of the Expo E2E.
#
# Proves, against a REAL Expo native build, two real-world things L1 (config
# assertions) can't:
#
#   1. the SDK is compatible with an Expo app's native build (Galva's vendored
#      Swift core + bridge + auto-wire compile under Expo's project + Xcode 26);
#   2. the deep-link scheme the config plugin registered actually ROUTES a gv://
#      URL to the app at runtime (the OS honors the generated Info.plist).
#
# Heavy (full native build), so this runs nightly + on manual trigger — L1 is the
# fast per-PR gate. Requires Xcode 26 + CocoaPods.
#
# Note: Expo SDK 56 pins React Native 0.85.3. If the build fails on `fmt`
# consteval under clang 21, apply the C++17 workaround from docs/ios-build.md
# (older RN compiles fmt from source; RN 0.86+ ships it prebuilt).
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE="$ROOT/e2e/expo"

# Prefer a STABLE Xcode 26 over whatever is active. Expo SDK 56's own
# `expo-modules-jsi` does not compile under Xcode 27 beta (a Swift-version issue
# in Expo's code, unrelated to Galva), and Galva's core needs Xcode 26+. CI
# selects Xcode 26 explicitly; this mirrors that for local runs so an active beta
# doesn't cause a confusing failure. Override by exporting DEVELOPER_DIR.
if [ -z "${DEVELOPER_DIR:-}" ]; then
  for cand in /Applications/Xcode_26*.app /Applications/Xcode.app; do
    if [ -d "$cand" ]; then export DEVELOPER_DIR="$cand/Contents/Developer"; break; fi
  done
  export DEVELOPER_DIR="${DEVELOPER_DIR:-$(xcode-select -p)}"
fi
export LANG="${LANG:-en_US.UTF-8}" LC_ALL="${LC_ALL:-en_US.UTF-8}"
echo "==> using $(DEVELOPER_DIR="$DEVELOPER_DIR" xcodebuild -version | head -1)"

ARTIFACTS="${ARTIFACTS_DIR:-$FIXTURE/.artifacts}"
mkdir -p "$ARTIFACTS"
GALVA_URL="gvexpoe2e://openCommunication?communicationId=e2e-test"
APP_ID="co.galva.expoe2e"

echo "==> pack @galva/react-native"
( cd "$ROOT" && npm pack --silent && mv galva-react-native-*.tgz "$FIXTURE/galva.tgz" )

echo "==> install + prebuild (iOS) the Expo fixture"
# --no-package-lock: the packed tarball's integrity changes every run, so a
# committed lockfile would EINTEGRITY-fail on re-pack.
( cd "$FIXTURE" && npm install --no-audit --no-fund --no-package-lock && npx expo prebuild --platform ios --clean )

echo "==> pod install"
( cd "$FIXTURE/ios" && pod install )

UDID="$(xcrun simctl list devices available | grep -E 'iPhone' \
  | grep -oE '[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}' | head -1)"
[ -n "$UDID" ] || { echo "error: no iPhone simulator available" >&2; exit 2; }
WS="$(ls -d "$FIXTURE"/ios/*.xcworkspace | head -1)"
SCHEME="$(basename "$WS" .xcworkspace)"

# Release embeds the JS bundle, so the app runs standalone (no Metro) — keeps the
# smoke deterministic.
echo "==> build $SCHEME (Release, JS embedded) for simulator $UDID"
xcodebuild build \
  -workspace "$WS" -scheme "$SCHEME" -configuration Release \
  -sdk iphonesimulator -destination "id=$UDID" \
  -derivedDataPath "$FIXTURE/ios/build" CODE_SIGNING_ALLOWED=NO
echo "✓ the Expo app built with Galva (SDK is Expo-native-build compatible)"

echo "==> boot + install"
xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b
APP="$(find "$FIXTURE/ios/build/Build/Products" -maxdepth 3 -name '*.app' | head -1)"
[ -n "$APP" ] || { echo "error: no .app produced" >&2; exit 1; }
xcrun simctl install "$UDID" "$APP"

# Best-effort capture of the app's [GALVA_E2E] console markers.
LOG="$ARTIFACTS/device.log"
( xcrun simctl spawn "$UDID" log stream --level debug \
    --predicate 'eventMessage CONTAINS "[GALVA_E2E]"' > "$LOG" 2>&1 ) &
LOGPID=$!
trap 'kill "$LOGPID" 2>/dev/null || true' EXIT

echo "==> launch app + let JS boot"
xcrun simctl launch "$UDID" "$APP_ID" || true
sleep 6

echo "==> open the Galva deep link (HARD GATE: the scheme must route to the app)"
if xcrun simctl openurl "$UDID" "$GALVA_URL"; then
  echo "✓ OS routed $GALVA_URL to the app — the plugin-registered scheme works at runtime"
else
  echo "✗ no app handled $GALVA_URL — the deep-link scheme is not registered" >&2
  exit 1
fi
sleep 4

xcrun simctl io "$UDID" screenshot "$ARTIFACTS/after-deeplink.png" 2>/dev/null || true

echo "--- [GALVA_E2E] markers ---"; cat "$LOG" 2>/dev/null || true
if grep -q "url_received $GALVA_URL" "$LOG" 2>/dev/null; then
  echo "✓ JS received the deep link"
else
  echo "ℹ JS-received marker not captured from the log — screenshot is the visual proof"
fi

echo "✓ Expo runtime smoke passed (native build + scheme routing). Artifacts: $ARTIFACTS"
