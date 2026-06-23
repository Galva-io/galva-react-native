#!/usr/bin/env ruby
# frozen_string_literal: true
#
# scripts/gen-e2e-target.rb
#
# Adds (and keeps correct) the app-hosted `GalvaExampleTests` target in the
# example Xcode project so the swizzler E2E (example/ios/GalvaExampleTests) runs
# inside the real app, through the real application lifecycle, against the real
# Galva pod.
#
# Idempotent: the target/files/dependency are created once, but build settings
# and the scheme's test list are *re-ensured* on every run with fixed values, so
# repeated runs converge to the same project (no churn) and a stale checkout
# self-heals. CI is then just pod install + xcodebuild test.
#
# Requires the `xcodeproj` gem (ships with CocoaPods).

require 'xcodeproj'

ROOT      = File.expand_path('..', __dir__)
PROJ_PATH = File.join(ROOT, 'example/ios/GalvaExample.xcodeproj')
TESTS_DIR = File.join(ROOT, 'example/ios/GalvaExampleTests')
APP_NAME  = 'GalvaExample'
TEST_NAME = 'GalvaExampleTests'

proj = Xcodeproj::Project.open(PROJ_PATH)
app  = proj.targets.find { |t| t.name == APP_NAME } or abort "error: no '#{APP_NAME}' target in #{PROJ_PATH}"

test = proj.targets.find { |t| t.name == TEST_NAME }
unless test
  # Objective-C unit-test bundle, hosted by the app.
  test = proj.new_target(:unit_test_bundle, TEST_NAME, :ios, '15.1', proj.products_group, :objc)

  group = proj.main_group.new_group(TEST_NAME, TESTS_DIR)
  %w[GalvaE2ECompetitorSwizzler.m GalvaSwizzleE2ETests.m].each do |f|
    test.add_file_references([group.new_reference(File.join(TESTS_DIR, f))])
  end
  group.new_reference(File.join(TESTS_DIR, 'GalvaE2ECompetitorSwizzler.h')) # header (no build phase)

  test.add_dependency(app)
  puts "created #{TEST_NAME} app-hosted test target"
end

# Always-ensure build settings (fixed values → idempotent).
test.build_configurations.each do |c|
  bs = c.build_settings
  bs['PRODUCT_NAME']                = '$(TARGET_NAME)'   # else the bundle is "".xctest
  bs['TEST_HOST']                   = "$(BUILT_PRODUCTS_DIR)/#{APP_NAME}.app/#{APP_NAME}"
  bs['BUNDLE_LOADER']               = '$(TEST_HOST)'
  bs['PRODUCT_BUNDLE_IDENTIFIER']   = 'org.reactjs.native.example.GalvaExample.Tests'
  bs['GENERATE_INFOPLIST_FILE']     = 'YES'
  bs['IPHONEOS_DEPLOYMENT_TARGET']  = '15.1'
  bs['CLANG_ENABLE_OBJC_ARC']       = 'YES'
  bs['CODE_SIGNING_ALLOWED']        = 'NO'
  bs['ENABLE_TESTING_SEARCH_PATHS'] = 'YES'              # find XCTest without an explicit ref
  bs['SWIFT_VERSION']               = '5.0'
  bs['LD_RUNPATH_SEARCH_PATHS']     = ['$(inherited)', '@executable_path/Frameworks', '@loader_path/Frameworks']
  bs['HEADER_SEARCH_PATHS']         = ['$(inherited)', '"$(SRCROOT)/GalvaExampleTests"']
end

proj.save

# Collapse the scheme's Testables to exactly our target. The RN template ships a
# dangling GalvaExampleTests testable (a non-existent blueprint), which would
# otherwise race ours to produce .../PlugIns/.xctest ("Multiple commands produce").
scheme_path = File.join(PROJ_PATH, 'xcshareddata', 'xcschemes', "#{APP_NAME}.xcscheme")
if File.exist?(scheme_path)
  scheme = Xcodeproj::XCScheme.new(scheme_path)
  testables = scheme.test_action.xml_element.elements['Testables']
  testables&.elements&.to_a&.each { |e| testables.delete_element(e) }
  scheme.add_test_target(test)
  scheme.save!
  puts "scheme test list set to a single #{TEST_NAME} testable"
end

puts "#{TEST_NAME} target ensured"
