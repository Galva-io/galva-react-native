package com.galva.reactnative

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

/**
 * Android placeholder for the Galva native module.
 *
 * Exposes the same JS surface as iOS so cross-platform code runs unchanged, but
 * every method is a no-op (promise methods resolve with neutral defaults) until
 * the real Android integration is implemented. A legacy module (works on both
 * the old and new architecture via the interop layer), matching iOS.
 */
class GalvaModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  // MARK: Configure & lifecycle
  @ReactMethod fun configureSDK(options: ReadableMap) { /* pending Android impl */ }
  @ReactMethod fun setOptOut(enabled: Boolean) {}
  @ReactMethod fun isOptedOut(promise: Promise) { promise.resolve(false) }
  @ReactMethod fun reconcileTransactions() {}
  @ReactMethod fun getSDKVersion(promise: Promise) { promise.resolve("0.0.0") }

  // MARK: Events
  @ReactMethod fun trackEvent(eventName: String, attributes: ReadableMap?) {}

  // MARK: Identity
  @ReactMethod fun identifyUser(userId: String, appAccountToken: String?) {}
  @ReactMethod fun logOut() {}
  @ReactMethod fun getIdentifiedUserId(promise: Promise) { promise.resolve(null) }
  @ReactMethod fun setUserAttributes(attributes: ReadableMap) {}

  // MARK: Push
  @ReactMethod fun registerAPNsToken(tokenHex: String) {}
  @ReactMethod fun registerFCMToken(token: String) {}
  @ReactMethod fun handleNotificationResponse(payload: ReadableMap) {}

  // MARK: Deep links
  @ReactMethod fun handleDeepLink(url: String, promise: Promise) { promise.resolve(false) }

  // MARK: In-app messages
  @ReactMethod fun showMessage(messageId: String, promise: Promise) { promise.resolve(null) }

  // MARK: NativeEventEmitter requirements (no-ops; no events emitted yet)
  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Double) {}

  private companion object {
    const val NAME = "Galva"
  }
}
