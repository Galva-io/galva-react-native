package com.galva.reactnative

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Dynamic
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.modules.core.DeviceEventManagerModule
import io.galva.common.logger.LogLevel
import io.galva.core.protocol.Configuration
import io.galva.core.protocol.Environment
import io.galva.core.protocol.identity.ProfileProperty
import io.galva.iam.Message
import io.galva.sdk.Galva
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Legacy bridge module (NOT a TurboModule / codegen spec) — exposed to JS as
 * "Galva". Plain [ReactContextBaseJavaModule] is version-agnostic: it runs on
 * the oldest RN the SDK targets and on the New Architecture via the bridging
 * interop layer. This is the deliberate distribution stance (plan §3.1).
 *
 * CORE-BACKED variant (plan §3.6) — compiled instead of `src/stub/kotlin`
 * when `Galva_androidCore=true`. Delegates to the core facade
 * `io.galva.sdk.Galva` (Maven AAR, interim mavenLocal/GitHub Packages while
 * `1.0.0-SNAPSHOT`). Methods the Android core doesn't expose yet remain
 * log-once gaps — `@platform ios` in the TS surface (plan §4), tracked as
 * upstream asks on galva-android.
 */
class GalvaModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = NAME

  private val warned = HashSet<String>()
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  /** Messages received off the core flow, keyed by id, so JS can `show(id)`. */
  private val pendingMessages = ConcurrentHashMap<String, Message>()
  private var streamJob: Job? = null
  private var listenerCount = 0

  /** Log each unbacked method once so the missing backing is visible (plan §4). */
  private fun gap(method: String) {
    if (warned.add(method)) {
      Log.w(NAME, "$method(): not exposed by the Android core yet — call is a no-op (plan §4).")
    }
  }

  override fun invalidate() {
    scope.cancel()
    super.invalidate()
  }

  // --- Galva (configure & global controls) ---------------------------------

  @ReactMethod
  fun configure(options: ReadableMap) {
    val apiKey = options.getString("apiKey").orEmpty()
    if (apiKey.isBlank()) {
      // Configuration's `require(apiKey.isNotBlank())` would crash the bridge
      // thread; JS already throws a TypeError before reaching here — just log.
      Log.e(NAME, "configure(): apiKey must not be blank.")
      return
    }
    val autoTrackLifecycle =
      !options.hasKey("autoTrackLifecycle") || options.getBoolean("autoTrackLifecycle")
    Galva.configure(
      reactApplicationContext.applicationContext,
      Configuration(
        apiKey = apiKey,
        logLevel = parseLogLevel(options.takeIf { it.hasKey("logLevel") }?.getString("logLevel")),
        autoTrackSessions = autoTrackLifecycle,
        env = parseEnvironment(options)
      )
    )
  }

  @ReactMethod
  fun setOptOut(enabled: Boolean) = gap("setOptOut")

  @ReactMethod
  fun isOptedOut(promise: Promise) {
    gap("isOptedOut")
    promise.resolve(false)
  }

  @ReactMethod
  fun setDeviceToken(token: String) =
    // On Android the push token IS the communication endpoint — covered by
    // registerPushToken; the core has no separate device-token concept.
    gap("setDeviceToken")

  @ReactMethod
  fun reconcileTransactions() = gap("reconcileTransactions")

  @ReactMethod
  fun sdkVersion(promise: Promise) {
    promise.resolve(io.galva.sdk.BuildConfig.SDK_VERSION)
  }

  // --- AppEvents ------------------------------------------------------------

  @ReactMethod
  fun track(eventName: String, attributes: ReadableMap?) =
    // The Android core has NO event-tracking API yet (its APIOperation set is
    // identity + push endpoints only) — the largest parity gap, tracked upstream.
    gap("track")

  // --- AppUser ----------------------------------------------------------------

  @ReactMethod
  fun identify(userId: String, appAccountToken: String?) {
    // iOS links purchases via the StoreKit appAccountToken (UUID); the Android
    // core's nearest primitive is the Play obfuscatedAccountId. Semantics
    // equivalence is an open upstream question (plan §4).
    Galva.instance.identify(userId, email = null, obfuscatedAccountId = appAccountToken)
  }

  @ReactMethod
  fun logout() {
    Galva.instance.logout()
  }

  @ReactMethod
  fun identifiedUserId(promise: Promise) {
    // Core's currentUserId falls back to the anonymousId; iOS resolves null
    // when anonymous — shim to the iOS-canonical semantics.
    val galva = Galva.instance
    promise.resolve(
      if (!galva.isConfigured || galva.isAnonymous) null else galva.currentUserId
    )
  }

  @ReactMethod
  fun isAnonymous(promise: Promise) {
    val galva = Galva.instance
    promise.resolve(!galva.isConfigured || galva.isAnonymous)
  }

  @ReactMethod
  fun setEmail(email: String) {
    Galva.instance.updateProperties(ProfileProperty.Email(email))
  }

  @ReactMethod
  fun setDisplayName(name: String) {
    // No FullName property type on Android — use the server trait key the iOS
    // core documents ("$gv_fullName"). Upstream ask: a typed trait + key
    // normalization (Android's own Email type sends plain "email").
    Galva.instance.updateProperties(ProfileProperty.Custom("\$gv_fullName", name))
  }

  @ReactMethod
  fun setUserProperty(key: String, value: Dynamic) {
    // JS types the value as string | number | boolean; anything else is
    // dropped to keep the trait payload JSON-clean (mirrors the iOS bridge).
    val converted: Any? = when (value.type) {
      ReadableType.Boolean -> value.asBoolean()
      ReadableType.Number -> value.asDouble()
      ReadableType.String -> value.asString()
      else -> null
    }
    if (converted != null) {
      Galva.instance.updateProperties(ProfileProperty.Custom(key, converted))
    }
  }

  @ReactMethod
  fun setUserProperties(properties: ReadableMap) {
    // Bulk trait set: convert each JSON-clean value and forward to the core,
    // mirroring setUserProperty per entry (the iOS core coerces in one call).
    val iterator = properties.keySetIterator()
    while (iterator.hasNextKey()) {
      val key = iterator.nextKey()
      val converted: Any? = when (properties.getType(key)) {
        ReadableType.Boolean -> properties.getBoolean(key)
        ReadableType.Number -> properties.getDouble(key)
        ReadableType.String -> properties.getString(key)
        else -> null
      }
      if (converted != null) {
        Galva.instance.updateProperties(ProfileProperty.Custom(key, converted))
      }
    }
  }

  // --- Communication ------------------------------------------------------------

  @ReactMethod
  fun isValidEmail(email: String, promise: Promise) {
    // No validation API on the Android core — mirrors the iOS core's basic
    // ingestion rules: one '@', non-empty local + dotted domain, no whitespace.
    promise.resolve(
      Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$").matches(email)
    )
  }

  @ReactMethod
  fun registerEmail(email: String) = gap("registerEmail")

  @ReactMethod
  fun unregisterEmail(email: String) = gap("unregisterEmail")

  @ReactMethod
  fun registerPushToken(token: String, platform: String?) {
    if (platform == "apns") {
      Log.w(NAME, "registerPushToken(): platform 'apns' ignored on Android — FCM implied.")
    }
    Galva.instance.setPushToken(token)
  }

  @ReactMethod
  fun unregisterPushToken(token: String, platform: String?) {
    // Core clears the CURRENT token — the passed token is not matched against
    // it (upstream ask: token-addressed unregister, like iOS).
    Galva.instance.clearPushToken()
  }

  @ReactMethod
  fun setCommunicationPreference(preference: ReadableMap) = gap("setCommunicationPreference")

  // --- InAppMessages --------------------------------------------------------------

  @ReactMethod
  fun checkForMessages() {
    // Deliberate no-op (NOT a gap): Android IAM is a reactive Flow polled by
    // the core's own foreground lifecycle observer — there is no manual poll.
  }

  @ReactMethod
  fun show(messageId: String, promise: Promise) {
    val message = pendingMessages[messageId]
    if (message == null) {
      promise.reject(
        "MESSAGE_NOT_FOUND",
        "No pending in-app message with id '$messageId' — ids must come from the `messages` emitter."
      )
      return
    }
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVE_SCENE", "No foreground activity to present in.")
      return
    }
    try {
      Galva.instance.showMessage(activity, message)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("SHOW_FAILED", e.message, e)
    }
  }

  // --- Event stream (core Flow → "galva#message") -----------------------------------

  @ReactMethod
  fun addListener(eventType: String) {
    synchronized(this) {
      listenerCount += 1
      if (streamJob == null) startStream()
    }
  }

  @ReactMethod
  fun removeListeners(count: Double) {
    synchronized(this) {
      listenerCount = maxOf(0, listenerCount - count.toInt())
      if (listenerCount == 0) {
        streamJob?.cancel()
        streamJob = null
      }
    }
  }

  private fun startStream() {
    streamJob = scope.launch {
      // JS may subscribe before configure() lands; the facade throws on
      // pre-configure access to the message flow — poll cheaply until ready.
      while (isActive && !Galva.instance.isConfigured) delay(200)
      Galva.instance.getInAppMessage().collect { message ->
        pendingMessages[message.id] = message
        val body = Arguments.createMap().apply {
          putString("id", message.id)
          // The Android core's Message carries only `id` (no createdAt /
          // rawType / workflowType yet — upstream ask — plan §4): stamp receipt
          // time; JS already treats workflowType as optional.
          putDouble("createdAt", System.currentTimeMillis().toDouble())
          putString("rawType", "")
        }
        reactApplicationContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit(MESSAGE_EVENT, body)
      }
    }
  }

  // --- Parsing helpers ---------------------------------------------------------------

  private fun parseEnvironment(options: ReadableMap): Environment {
    if (!options.hasKey("environment")) return Environment.Production
    return when (options.getType("environment")) {
      ReadableType.String ->
        if (options.getString("environment") == "development") Environment.Development
        else Environment.Production
      ReadableType.Map -> {
        val map = options.getMap("environment")
        val api = map?.getString("apiBaseURL")
        val cdn = map?.getString("webviewBundleCDN")
        // Match the iOS bridge: custom needs BOTH URLs, else production.
        // (The core's own Configuration default is Development — the bridge
        // overrides it to keep production-by-default parity with iOS.)
        if (api != null && cdn != null) Environment.Custom(api, cdn) else Environment.Production
      }
      else -> Environment.Production
    }
  }

  private fun parseLogLevel(value: String?): LogLevel = when (value) {
    "debug" -> LogLevel.DEBUG
    "info", "notice" -> LogLevel.INFO
    "warning" -> LogLevel.WARN
    "error", "fault" -> LogLevel.ERROR
    "off" -> LogLevel.NONE
    else -> LogLevel.WARN
  }

  companion object {
    const val NAME = "Galva"
    private const val MESSAGE_EVENT = "galva#message"
  }
}
