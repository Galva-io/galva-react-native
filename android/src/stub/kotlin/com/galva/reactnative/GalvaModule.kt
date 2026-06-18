package com.galva.reactnative

import android.util.Log
import com.facebook.react.bridge.Dynamic
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

/**
 * Legacy bridge module (NOT a TurboModule / codegen spec) — exposed to JS as
 * "Galva". Plain [ReactContextBaseJavaModule] is version-agnostic: it runs on
 * the oldest RN the SDK targets and on the New Architecture via the bridging
 * interop layer. This is the deliberate distribution stance (plan §3.1).
 *
 * PHASE-2 STUB (plan §3.6 / §7) — the DEFAULT source set: the Android core
 * (Galva-io/galva-android) exists but is unreleased (`1.0.0-SNAPSHOT`), so
 * every method here is a stub — void calls no-op, getters resolve neutral
 * defaults, `show` rejects — each logging once so the gap is visible, never a
 * silent success pretending to be backed.
 *
 * The REAL backing lives in `src/core/kotlin` (same class, only one of the two
 * source sets compiles) — opt in with `Galva_androidCore=true` while the core
 * is consumed from mavenLocal/GitHub Packages; the toggle's default flips when
 * `io.galva.sdk:galva-sdk:1.0.0` ships on Maven Central.
 */
class GalvaModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = NAME

  private val warned = HashSet<String>()

  /** Log each stubbed method once so the missing backing is visible (plan §4). */
  private fun stub(method: String) {
    if (warned.add(method)) {
      Log.w(NAME, "$method(): Android core not released yet — call is a no-op (plan §3.6).")
    }
  }

  // --- Galva (configure & global controls) ---------------------------------

  @ReactMethod
  fun configure(options: ReadableMap) = stub("configure")

  @ReactMethod
  fun setOptOut(enabled: Boolean) = stub("setOptOut")

  @ReactMethod
  fun isOptedOut(promise: Promise) {
    stub("isOptedOut")
    promise.resolve(false)
  }

  @ReactMethod
  fun setDeviceToken(token: String) = stub("setDeviceToken")

  @ReactMethod
  fun reconcileTransactions() = stub("reconcileTransactions")

  @ReactMethod
  fun sdkVersion(promise: Promise) {
    stub("sdkVersion")
    promise.resolve("0.0.0-android-stub")
  }

  // --- AppEvents ------------------------------------------------------------

  @ReactMethod
  fun track(eventName: String, attributes: ReadableMap?) = stub("track")

  // --- AppUser ----------------------------------------------------------------

  @ReactMethod
  fun identify(userId: String, appAccountToken: String?) = stub("identify")

  @ReactMethod
  fun logout() = stub("logout")

  @ReactMethod
  fun identifiedUserId(promise: Promise) {
    stub("identifiedUserId")
    promise.resolve(null)
  }

  @ReactMethod
  fun isAnonymous(promise: Promise) {
    stub("isAnonymous")
    promise.resolve(true)
  }

  @ReactMethod
  fun setEmail(email: String) = stub("setEmail")

  @ReactMethod
  fun setDisplayName(name: String) = stub("setDisplayName")

  @ReactMethod
  fun setUserProperty(key: String, value: Dynamic) = stub("setUserProperty")

  @ReactMethod
  fun setUserProperties(properties: ReadableMap) = stub("setUserProperties")

  // --- Communication ------------------------------------------------------------

  @ReactMethod
  fun isValidEmail(email: String, promise: Promise) {
    // Mirrors the iOS core's basic ingestion rules closely enough for a stub:
    // one '@', non-empty local + dotted domain, no whitespace.
    promise.resolve(
      Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$").matches(email)
    )
  }

  @ReactMethod
  fun registerEmail(email: String) = stub("registerEmail")

  @ReactMethod
  fun unregisterEmail(email: String) = stub("unregisterEmail")

  @ReactMethod
  fun registerPushToken(token: String, platform: String?) = stub("registerPushToken")

  @ReactMethod
  fun unregisterPushToken(token: String, platform: String?) = stub("unregisterPushToken")

  @ReactMethod
  fun setCommunicationPreference(preference: ReadableMap) = stub("setCommunicationPreference")

  // --- InAppMessages --------------------------------------------------------------

  @ReactMethod
  fun checkForMessages() = stub("checkForMessages")

  @ReactMethod
  fun show(messageId: String, promise: Promise) {
    promise.reject(
      "NOT_IMPLEMENTED",
      "Galva.show(): the Android core is not released yet (plan §3.6) — in-app messages are iOS-only for now."
    )
  }

  // --- NativeEventEmitter contract -------------------------------------------------
  // No events fire on Android yet (the `messages` stream is iOS-backed), but
  // these must exist so `new NativeEventEmitter(NativeModules.Galva)` does not
  // warn on RN ≥ 0.65.

  @ReactMethod
  fun addListener(eventType: String) = Unit

  @ReactMethod
  fun removeListeners(count: Double) = Unit

  companion object {
    const val NAME = "Galva"
  }
}
