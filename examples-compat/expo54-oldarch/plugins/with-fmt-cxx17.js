// Xcode 26.5's clang rejects the consteval usage in the fmt version that
// RN 0.81 (Expo SDK 54) still compiles from source ("call to consteval
// function ... is not a constant expression" in format-inl.h); newer RN fixed
// this upstream by bumping fmt. Workaround: build the fmt pod as C++17 —
// consteval is a C++20 feature and fmt's headers adapt per translation unit.
//
// It must be injected AFTER react_native_post_install, which writes
// CLANG_CXX_LANGUAGE_STANDARD = c++20 into every pod's pbxproj build settings
// (overriding any xcconfig edit). Local consumer-side patch — not a Galva
// issue (fmt fails before the Galva pod compiles).
const { withPodfile } = require('@expo/config-plugins');

const SNIPPET = `
    # [examples-compat] fmt vs Xcode 26 — see plugins/with-fmt-cxx17.js
    installer.pods_project.targets.each do |t|
      next unless t.name == 'fmt'
      t.build_configurations.each do |bc|
        bc.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      end
    end
`;

module.exports = function withFmtCxx17(config) {
  return withPodfile(config, (c) => {
    if (!c.modResults.contents.includes("t.name == 'fmt'")) {
      c.modResults.contents = c.modResults.contents.replace(
        /(    react_native_post_install\(\n(?:.*\n)*?    \)\n)/,
        `$1${SNIPPET}`
      );
    }
    return c;
  });
};
