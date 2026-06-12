# Using Galva on older React Native

`@galva/react-native` declares **no React Native floor** — it uses the legacy
bridge (`NativeModules` + `NativeEventEmitter`, no codegen), so it runs on the
Old Architecture natively and on the New Architecture through RN's interop
layer.

What that means in practice on a 2026 toolchain (Xcode 26, modern AGP/Node):

| Your RN version | Status |
|---|---|
| **0.71+** | Works as-is — `npm install`, `pod install`, done. |
| **0.70** | Works **with the era patches below** (all verified end-to-end — a complete working reference app lives in [`examples-compat/rn070-oldarch`](../examples-compat/rn070-oldarch)). |
| **≤ 0.6x** | Not buildable at all on current toolchains, independent of Galva: the RN team's toolchain fixes were only ever backported down to 0.70 ([Xcode 15 fix](https://github.com/facebook/react-native/commit/5bd1a4256e0f55bada2b3c277e1dc8aba67a57ce), [#37748](https://github.com/facebook/react-native/issues/37748)); the [Xcode 12.5 guide](https://github.com/facebook/react-native/issues/31480) never covered 0.60. Upgrade RN first. |

Galva's own floors apply regardless: **iOS deployment target ≥ 15.0, Android
minSdk ≥ 24, the building machine needs Xcode 26+** (the vendored Galva core
is Swift 6).

## RN 0.70 patch list

Each item is a consumer-side workaround for *RN-0.70-era code on a modern
toolchain* — none of them touch Galva itself.

**1. Floors** — `android/build.gradle`: `minSdkVersion = 24`; `ios/Podfile`:
`platform :ios, '15.0'`.

**2. Yoga `-Werror`** (deprecated-literal-operator errors under new clang) —
patch via [`patch-package`](https://www.npmjs.com/package/patch-package):

```diff
--- a/node_modules/react-native/ReactCommon/yoga/Yoga.podspec
+++ b/node_modules/react-native/ReactCommon/yoga/Yoga.podspec
@@ -37,7 +37,7 @@
       '-Wall',
-      '-Werror',
+      '',
```

**3. Podfile `post_install`** — remove the M1 workaround call (it forces every
pod to deployment target 11, which breaks Swift availability checks) but keep
its one still-needed piece, the RCT-Folly `Time.h` fix:

```ruby
post_install do |installer|
  react_native_post_install(installer, :mac_catalyst_enabled => false)
  # __apply_Xcode_12_5_M1_post_install_workaround(installer)   # ← remove
  `sed -i -e $'s/ && (__IPHONE_OS_VERSION_MIN_REQUIRED < __IPHONE_10_0)//' Pods/RCT-Folly/folly/portability/Time.h`
end
```

**4. Disable Flipper** (doesn't compile under Xcode 26) — in the Podfile:
`:flipper_configuration => FlipperConfiguration.disabled`.

**5. One empty Swift file in the app target** — RN 0.70's app template is
ObjC-only; linking any Swift static pod (Galva included) needs the Swift
runtime, which Xcode only links when the target contains Swift. In Xcode:
File → New → Swift File (accept the bridging-header prompt), content can be a
comment. (`-l`/`-force_load` linker flags are NOT sufficient.)

**6. Metro on Node 22+** — if watchman's state dir is root-owned, Metro 0.72
crashes on start; run Metro with watchman hidden:

```sh
env PATH="/usr/bin:/bin:/usr/sbin:/sbin:$(dirname "$(which node)")" npx react-native start
```

## Below autolinking?

RN ≥ 0.60 autolinks Galva. There is no supported path for RN < 0.60 (see the
table above — those toolchains no longer build at all).
