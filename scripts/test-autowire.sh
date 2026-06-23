#!/usr/bin/env bash
#
# scripts/test-autowire.sh
#
# Deterministic unit tests for the push auto-wiring swizzler (ios/autowire).
# Generates a standalone XCTest *logic* bundle that compiles the real
# GalvaAutoWire.m plus a recording stub of the forward shim — NO Pods, no Galva
# core, no React — and runs it on an iOS simulator. The swizzler's behavior is
# pure ObjC-runtime, so this proves chaining / completion-handler-once / opt-out
# / idempotency / coexistence with zero app dependencies.
#
# Requires: Xcode 26+ (the Galva core's toolchain) and the `xcodeproj` Ruby gem
# (ships with CocoaPods).
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUTOWIRE="$ROOT/ios/autowire"
BUILD="$ROOT/.autowire-test"
PROJ="$BUILD/GalvaAutoWireTests.xcodeproj"

export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"

rm -rf "$BUILD"
mkdir -p "$BUILD"

echo "==> Generating test project (xcodeproj)"
ruby <<RUBY
require 'xcodeproj'
proj = Xcodeproj::Project.new("$PROJ")
target = proj.new_target(:unit_test_bundle, 'GalvaAutoWireTests', :ios, '15.1')
group = proj.main_group.new_group('Sources')
%w[
  GalvaAutoWire.m
  __tests__/GalvaAutoWireStub.m
  __tests__/GalvaAutoWireTests.m
].each do |rel|
  ref = group.new_file(File.join("$AUTOWIRE", rel))
  target.add_file_references([ref])
end
target.build_configurations.each do |c|
  c.build_settings['HEADER_SEARCH_PATHS'] = ['$AUTOWIRE']
  c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
  c.build_settings['CLANG_ENABLE_OBJC_ARC'] = 'YES'
  c.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  c.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'io.galva.autowiretests'
  c.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
  c.build_settings['ENABLE_TESTING_SEARCH_PATHS'] = 'YES'
  c.build_settings['ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES'] = 'NO'
end
proj.save
scheme = Xcodeproj::XCScheme.new
scheme.add_test_target(target)
scheme.save_as("$PROJ", 'GalvaAutoWireTests', true)
puts "  generated #{File.basename("$PROJ")}"
RUBY

UDID="$(xcrun simctl list devices available | grep -E 'iPhone' \
  | grep -oE '[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}' | head -1)"
[ -n "$UDID" ] || { echo "error: no iPhone simulator available" >&2; exit 2; }
echo "==> Running on simulator $UDID"

xcodebuild test \
  -project "$PROJ" \
  -scheme GalvaAutoWireTests \
  -destination "platform=iOS Simulator,id=$UDID" \
  CODE_SIGNING_ALLOWED=NO
