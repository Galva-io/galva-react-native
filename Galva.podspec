require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# Build settings (iOS floor, Swift version, libsqlite3) come from galva-ios and
# are vendored alongside Sources, so the pod can't drift from Package.swift.
require_relative "ios/galva-src/galva-build.rb"

Pod::Spec.new do |s|
  s.name     = "Galva"
  s.version  = package["version"]
  s.summary  = package["description"]
  s.homepage = package["homepage"]
  s.license  = package["license"]
  s.authors  = package["author"]
  s.source   = { :git => "https://github.com/Galva-io/galva-react-native.git", :tag => s.version.to_s }

  # Mode B: compile the RN bridge + auto-wiring shims + the vendored first-party
  # Galva core (ios/galva-src, pinned via scripts/sync-galva.sh + galva.lock.json)
  # in ONE pod. CocoaPods links static by default -> no use_frameworks!, zero
  # Podfile edits. Bridge and core share one Swift module, so the bridge calls
  # the core directly (no import; the bridge class is GalvaModule, not Galva, to
  # avoid colliding with the core's public `Galva` type).
  s.source_files =
    "ios/bridge/**/*.{h,m,mm,swift}",
    "ios/autowire/**/*.{h,m,swift}",
    "ios/galva-src/Sources/**/*.swift"

  # Swizzler unit tests live next to the swizzler but must never ship in the pod.
  s.exclude_files = "ios/**/__tests__/**/*"

  # platform (iOS 15) / swift_versions (6.0) / library (sqlite3) — single source
  # of truth lives in galva-ios's cocoapods/galva-build.rb, vendored above.
  galva_apply_build_settings(s)

  # React dependency: the modern helper wires React-Core/New-Arch correctly on
  # RN >= 0.71; older RN (down to our 0.70 floor) gets the classic dependency.
  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"
  end
end
