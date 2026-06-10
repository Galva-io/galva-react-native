require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "Galva"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/Galva-io/galva-react-native.git", :tag => "#{s.version}" }

  # Swift 6 to match the vendored Galva core.
  s.swift_version = "6.0"

  # ---------------------------------------------------------------------------
  # Mode B (plan §3.4): compile the RN bridge AND the vendored first-party core
  # (ios/galva-src — pinned via scripts/sync-galva.sh + galva.lock.json) in one
  # pod target. CocoaPods links static by default → no use_frameworks!, zero
  # Podfile edit. Bridge and core share one module, so the bridge reaches the
  # core without an import (the bridge class is named GalvaModule to avoid
  # colliding with the core's public `Galva` type).
  # ---------------------------------------------------------------------------
  s.source_files = "ios/bridge/**/*.{h,m,mm,swift}", "ios/galva-src/Sources/**/*.swift"
  s.libraries    = "sqlite3"                 # system libsqlite3 (Package.swift linkedLibrary)
  s.frameworks   = "StoreKit", "WebKit"      # core imports these system frameworks

  install_modules_dependencies(s)
end
