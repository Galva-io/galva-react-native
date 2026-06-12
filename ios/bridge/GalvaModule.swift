import Foundation
import React
import UIKit

/// Legacy RN bridge module (NOT a TurboModule). Exposed to JS as "Galva" via
/// `RCT_EXTERN_REMAP_MODULE` in GalvaModule.m. The class is named
/// `GalvaModule` (not `Galva`) on purpose: the vendored core (ios/galva-src)
/// compiles into the same pod module and defines its own public `Galva` type
/// (plan §3.1). Because bridge and core share one module, the bridge calls the
/// core directly — no `import Galva`.
///
/// Surface is 1:1 with the core facade (Galva / AppEvents / AppUser /
/// Communication / InAppMessages). Core APIs are fire-and-forget and
/// thread-safe, so most methods are plain void calls off RN's method queue;
/// getters resolve promises from the core's synchronous snapshots.
@objc(GalvaModule)
final class GalvaModule: RCTEventEmitter, @unchecked Sendable {

  private static let messageEvent = "galva#message"

  /// Promise blocks aren't Sendable; box them to carry into @MainActor tasks.
  private struct PromiseBox: @unchecked Sendable {
    let resolve: RCTPromiseResolveBlock
    let reject: RCTPromiseRejectBlock
  }

  /// Messages received off the core stream, keyed by id, so JS can pass an id
  /// back to `show`. Written from the MainActor stream task, read from RN's
  /// method queue.
  private let registryLock = NSLock()
  private var pendingMessages: [String: InAppMessages.Message] = [:]
  private var streamTask: Task<Void, Never>?

  // Sync wrappers — NSLock.lock()/unlock() may not be called directly from an
  // async context (Swift 6); routing through a sync method is the sanctioned
  // pattern for these short, non-blocking critical sections.
  private func storeMessage(_ message: InAppMessages.Message) {
    registryLock.lock()
    defer { registryLock.unlock() }
    pendingMessages[message.id] = message
  }

  private func pendingMessage(id: String) -> InAppMessages.Message? {
    registryLock.lock()
    defer { registryLock.unlock() }
    return pendingMessages[id]
  }

  override static func requiresMainQueueSetup() -> Bool { false }

  override func supportedEvents() -> [String] { [Self.messageEvent] }

  deinit { streamTask?.cancel() }

  // MARK: - Event stream (InAppMessages.messages → "galva#message")

  override func startObserving() {
    streamTask?.cancel()
    streamTask = Task { @MainActor [weak self] in
      for await message in InAppMessages.messages {
        guard let self else { return }
        self.storeMessage(message)
        var body: [String: Any] = [
          "id": message.id,
          "createdAt": message.createdAt.timeIntervalSince1970 * 1000,
          "rawType": message.rawType,
        ]
        body["workflowType"] = message.workflowType?.rawValue
        self.sendEvent(withName: Self.messageEvent, body: body)
      }
    }
  }

  override func stopObserving() {
    streamTask?.cancel()
    streamTask = nil
  }

  // MARK: - Galva (configure & global controls)

  @objc(configure:)
  func configure(_ options: NSDictionary) {
    let apiKey = options["apiKey"] as? String ?? ""
    let autoTrackLifecycle = options["autoTrackLifecycle"] as? Bool ?? true
    Galva.configure(
      apiKey: apiKey,
      environment: Self.parseEnvironment(options["environment"]),
      autoTrackCategories: autoTrackLifecycle ? [.lifecycle] : [],
      logLevel: Self.parseLogLevel(options["logLevel"])
    )
  }

  @objc(setOptOut:)
  func setOptOut(_ enabled: Bool) {
    Galva.setOptOut(enabled)
  }

  @objc(isOptedOut:withRejecter:)
  func isOptedOut(_ resolve: RCTPromiseResolveBlock, withRejecter reject: RCTPromiseRejectBlock) {
    resolve(Galva.isOptedOut)
  }

  @objc(setDeviceToken:)
  func setDeviceToken(_ token: String) {
    Galva.setDeviceToken(token)
  }

  @objc(reconcileTransactions)
  func reconcileTransactions() {
    Galva.reconcileTransactions()
  }

  @objc(sdkVersion:withRejecter:)
  func sdkVersion(_ resolve: RCTPromiseResolveBlock, withRejecter reject: RCTPromiseRejectBlock) {
    // Internal constant, reachable because bridge and core share the module.
    resolve(SDKConstants.version)
  }

  // MARK: - AppEvents

  @objc(track:withAttributes:)
  func track(_ eventName: String, withAttributes attributes: NSDictionary?) {
    AppEvents.track(eventName, attributes: attributes as? [String: Any])
  }

  // MARK: - AppUser

  @objc(identify:withAppAccountToken:)
  func identify(_ userId: String, withAppAccountToken token: String?) {
    // JS validates the UUID format up front; an unparseable token degrades to
    // an identify without purchase linking rather than dropping the call.
    AppUser.identify(userId: userId, appAccountToken: token.flatMap(UUID.init(uuidString:)))
  }

  @objc(logout)
  func logout() {
    AppUser.logOut()
  }

  @objc(identifiedUserId:withRejecter:)
  func identifiedUserId(_ resolve: RCTPromiseResolveBlock, withRejecter reject: RCTPromiseRejectBlock) {
    resolve(AppUser.identifiedUserId)
  }

  @objc(isAnonymous:withRejecter:)
  func isAnonymous(_ resolve: RCTPromiseResolveBlock, withRejecter reject: RCTPromiseRejectBlock) {
    resolve(AppUser.identifiedUserId == nil)
  }

  @objc(setEmail:)
  func setEmail(_ email: String) {
    AppUser.set(.email, email)
  }

  @objc(setDisplayName:)
  func setDisplayName(_ name: String) {
    AppUser.set(.fullName, name)
  }

  @objc(setUserProperty:withValue:)
  func setUserProperty(_ key: String, withValue value: Any) {
    // JS types the value as string | number | boolean; anything else is
    // dropped here to keep the trait payload JSON-clean.
    switch value {
    case let number as NSNumber:
      if CFGetTypeID(number) == CFBooleanGetTypeID() {
        AppUser.set(key, number.boolValue)
      } else {
        AppUser.set(key, number.doubleValue)
      }
    case let string as String:
      AppUser.set(key, string)
    default:
      break
    }
  }

  // MARK: - Communication

  @objc(isValidEmail:withResolver:withRejecter:)
  func isValidEmail(
    _ email: String,
    withResolver resolve: RCTPromiseResolveBlock,
    withRejecter reject: RCTPromiseRejectBlock
  ) {
    resolve(Communication.isValidEmail(email))
  }

  @objc(registerEmail:)
  func registerEmail(_ email: String) {
    Communication.registerEmail(email)
  }

  @objc(unregisterEmail:)
  func unregisterEmail(_ email: String) {
    Communication.unregisterEmail(email)
  }

  @objc(registerPushToken:withPlatform:)
  func registerPushToken(_ token: String, withPlatform platform: String?) {
    Communication.registerPushToken(token, platform: Self.parsePushPlatform(platform))
  }

  @objc(unregisterPushToken:withPlatform:)
  func unregisterPushToken(_ token: String, withPlatform platform: String?) {
    Communication.unregisterPushToken(token, platform: Self.parsePushPlatform(platform))
  }

  @objc(setCommunicationPreference:)
  func setCommunicationPreference(_ options: NSDictionary) {
    guard
      let rawChannel = options["channel"] as? String,
      let channel = Communication.Channel(rawValue: rawChannel)
    else { return }
    Communication.setPreference(
      channel: channel,
      disabled: options["disabled"] as? Bool,
      categories: options["categories"] as? [String: Bool]
    )
  }

  // MARK: - InAppMessages

  @objc(checkForMessages)
  func checkForMessages() {
    InAppMessages.checkForMessages()
  }

  @objc(show:withResolver:withRejecter:)
  func show(
    _ messageId: String,
    withResolver resolve: @escaping RCTPromiseResolveBlock,
    withRejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let message = pendingMessage(id: messageId) else {
      reject(
        "MESSAGE_NOT_FOUND",
        "No pending in-app message with id '\(messageId)' — ids must come from the `messages` emitter.",
        nil
      )
      return
    }
    let promise = PromiseBox(resolve: resolve, reject: reject)
    Task { @MainActor in
      guard
        let scene = UIApplication.shared.connectedScenes
          .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene
      else {
        promise.reject("NO_ACTIVE_SCENE", "No foreground-active window scene to present in.", nil)
        return
      }
      do {
        try await message.show(in: scene)
        promise.resolve(nil)
      } catch let error as InAppMessages.Error {
        promise.reject(Self.code(for: error), Self.describe(error), error as NSError)
      } catch {
        promise.reject("SHOW_FAILED", error.localizedDescription, error as NSError)
      }
    }
  }

  // MARK: - Parsing helpers

  private static func parseEnvironment(_ value: Any?) -> Galva.Environment {
    if let name = value as? String {
      return name == "development" ? .development : .production
    }
    if let dict = value as? [String: Any],
       let api = (dict["apiBaseURL"] as? String).flatMap(URL.init(string:)),
       let cdn = (dict["webviewBundleCDN"] as? String).flatMap(URL.init(string:)) {
      return .custom(apiBaseURL: api, webviewBundleCDN: cdn)
    }
    return .production
  }

  private static func parseLogLevel(_ value: Any?) -> Galva.LogLevel {
    switch value as? String {
    case "debug": return .debug
    case "info": return .info
    case "notice": return .notice
    case "warning": return .warning
    case "error": return .error
    case "fault": return .fault
    case "off": return .off
    default: return .warning
    }
  }

  private static func parsePushPlatform(_ value: String?) -> Communication.PushPlatform {
    value == "fcm" ? .fcm : .apns
  }

  private static func code(for error: InAppMessages.Error) -> String {
    switch error {
    case .notConfigured: return "NOT_CONFIGURED"
    case .messageNotFound: return "MESSAGE_NOT_FOUND"
    case .bundleUnavailable: return "BUNDLE_UNAVAILABLE"
    case .bridgeProtocolMismatch: return "BRIDGE_PROTOCOL_MISMATCH"
    }
  }

  private static func describe(_ error: InAppMessages.Error) -> String {
    switch error {
    case .notConfigured:
      return "Galva is not configured — call configure() first."
    case .messageNotFound:
      return "The server no longer considers this message valid."
    case .bundleUnavailable:
      return "The WebView bundle for this message could not be downloaded."
    case .bridgeProtocolMismatch:
      return "This message needs a newer SDK bridge protocol — update @galva/react-native."
    }
  }
}
