//
//  GalvaModule.swift
//  @galva/react-native
//
//  Legacy RN bridge module (NOT a TurboModule), exposed to JS as "Galva" via
//  RCT_EXTERN_REMAP_MODULE in GalvaModule.m. Legacy modules run on BOTH the old
//  and new architecture (the New Architecture bridges them through its interop
//  layer), which is how one bridge spans RN 0.70 → 0.8x.
//
//  The class is named `GalvaModule`, not `Galva`, on purpose: the vendored core
//  (ios/galva-src) compiles into the SAME pod module and defines its own public
//  `Galva` type. Sharing one Swift module lets the bridge call the core directly
//  — no `import Galva` — and reach the internal helpers the JS forwarders need
//  (`NotificationResponse`, `NotificationEvent`).
//
//  Threading: every core entry point is fire-and-forget (it hops to the core's
//  global actor internally) or a synchronous snapshot read, so bridge methods
//  run on RN's background method queue without blocking JS. Only `showMessage`
//  touches UIKit, and it hops to the main actor.
//

import Foundation
import React
import UIKit

@objc(GalvaModule)
final class GalvaModule: RCTEventEmitter, @unchecked Sendable {

  /// JS event name carrying each in-app message off `InAppMessages.messages`.
  private static let messageEvent = "galva#message"

  /// Promise blocks aren't `Sendable`; box them to carry into `@MainActor` tasks.
  private struct PromiseBox: @unchecked Sendable {
    let resolve: RCTPromiseResolveBlock
    let reject: RCTPromiseRejectBlock
  }

  // Messages received off the stream, keyed by id, so JS can pass an id back to
  // `showMessage`. Written from the MainActor stream task, read from the method
  // queue — guarded by a lock (held only across tiny, non-async critical sections).
  private let registryLock = NSLock()
  private var pendingMessages: [String: InAppMessages.Message] = [:]
  private var streamTask: Task<Void, Never>?

  private func storeMessage(_ message: InAppMessages.Message) {
    registryLock.lock(); defer { registryLock.unlock() }
    pendingMessages[message.id] = message
  }

  private func pendingMessage(id: String) -> InAppMessages.Message? {
    registryLock.lock(); defer { registryLock.unlock() }
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

  // MARK: - Configure & lifecycle

  @objc(configureSDK:)
  func configureSDK(_ options: NSDictionary) {
    Galva.configure(
      apiKey: options["apiKey"] as? String ?? "",
      environment: Self.parseEnvironment(options["environment"]),
      autoTrackCategories: Self.parseAutoTrack(options["autoTrack"]),
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

  @objc(reconcileTransactions)
  func reconcileTransactions() {
    Galva.reconcileTransactions()
  }

  @objc(getSDKVersion:withRejecter:)
  func getSDKVersion(_ resolve: RCTPromiseResolveBlock, withRejecter reject: RCTPromiseRejectBlock) {
    resolve(Galva.sdkVersion)
  }

  // MARK: - Events

  @objc(trackEvent:withAttributes:)
  func trackEvent(_ eventName: String, withAttributes attributes: NSDictionary?) {
    AppEvents.track(eventName, attributes: attributes as? [String: Any])
  }

  // MARK: - Identity

  @objc(identifyUser:withAppAccountToken:)
  func identifyUser(_ userId: String, withAppAccountToken token: String?) {
    // JS validates the UUID shape; an unparseable token degrades to an identify
    // without purchase linking rather than dropping the call.
    AppUser.identify(userId: userId, appAccountToken: token.flatMap(UUID.init(uuidString:)))
  }

  @objc(logOut)
  func logOut() {
    AppUser.logOut()
  }

  @objc(getIdentifiedUserId:withRejecter:)
  func getIdentifiedUserId(_ resolve: RCTPromiseResolveBlock, withRejecter reject: RCTPromiseRejectBlock) {
    resolve(AppUser.identifiedUserId)
  }

  @objc(setUserAttributes:)
  func setUserAttributes(_ attributes: NSDictionary) {
    // Bulk trait set; the core coerces each value (lenient mirror of `track`).
    AppUser.set(attributes as? [String: Any] ?? [:])
  }

  // MARK: - Push (escape hatches — swizzling in ios/autowire is the default)

  @objc(registerAPNsToken:)
  func registerAPNsToken(_ tokenHex: String) {
    // Apps that source the APNs token from another push lib feed it here; the
    // core hex-decodes nothing — it re-encodes Data — so we decode hex → Data.
    guard let data = Self.data(fromHex: tokenHex) else { return }
    Galva.applicationDidRegisterForRemoteNotificationsWithDeviceToken(data)
  }

  @objc(registerFCMToken:)
  func registerFCMToken(_ token: String) {
    // Android-only today. iOS FCM support is pending (see docs); no-op here so
    // cross-platform JS can call it unconditionally.
    _ = token
  }

  @objc(handleNotificationResponse:)
  func handleNotificationResponse(_ payload: NSDictionary) {
    // Manual forwarder for apps that own the notification delegate (or opt out
    // of swizzling). Mirrors `Galva.userNotificationCenter(_:didReceive:)` by
    // reusing the same internal helpers — gated to Galva-originated payloads.
    guard
      let userInfo = payload["userInfo"] as? [AnyHashable: Any],
      NotificationResponse.isFromGalva(userInfo)
    else { return }
    let id = payload["id"] as? String ?? ""
    let dismissed = (payload["action"] as? String) == "dismiss"
    let eventName = dismissed ? NotificationEvent.dismissed : NotificationEvent.tapped
    AppEvents.track(eventName, attributes: NotificationResponse.attributes(id: id, userInfo: userInfo))
  }

  // MARK: - Deep links

  @objc(handleDeepLink:withResolver:withRejecter:)
  func handleDeepLink(
    _ url: String,
    withResolver resolve: RCTPromiseResolveBlock,
    withRejecter reject: RCTPromiseRejectBlock
  ) {
    guard let parsed = URL(string: url) else { resolve(false); return }
    resolve(Galva.handleOpenURL(parsed))
  }

  // MARK: - In-app messages

  @objc(showMessage:withResolver:withRejecter:)
  func showMessage(
    _ messageId: String,
    withResolver resolve: @escaping RCTPromiseResolveBlock,
    withRejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let message = pendingMessage(id: messageId) else {
      reject(
        "MESSAGE_NOT_FOUND",
        "No pending in-app message with id '\(messageId)' — ids come from the message observer.",
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

  private static func parseAutoTrack(_ value: Any?) -> Galva.AutoTrackCategory {
    // Both default ON (mirrors the core default [.lifecycle, .appleSearchAds]).
    let dict = value as? [String: Any] ?? [:]
    var categories: Galva.AutoTrackCategory = []
    if (dict["lifecycle"] as? Bool) ?? true { categories.insert(.lifecycle) }
    if (dict["appleSearchAds"] as? Bool) ?? true { categories.insert(.appleSearchAds) }
    return categories
  }

  private static func parseLogLevel(_ value: Any?) -> Galva.LogLevel {
    switch value as? String {
    case "debug":   return .debug
    case "info":    return .info
    case "notice":  return .notice
    case "warning": return .warning
    case "error":   return .error
    case "fault":   return .fault
    case "off":     return .off
    default:        return .warning
    }
  }

  /// Decode an APNs device-token hex string (with or without `<…>` wrapping)
  /// into `Data`. Returns `nil` for odd-length or non-hex input.
  private static func data(fromHex hex: String) -> Data? {
    let clean = hex.filter { $0.isHexDigit }
    guard !clean.isEmpty, clean.count % 2 == 0 else { return nil }
    var data = Data(capacity: clean.count / 2)
    var index = clean.startIndex
    while index < clean.endIndex {
      let next = clean.index(index, offsetBy: 2)
      guard let byte = UInt8(clean[index..<next], radix: 16) else { return nil }
      data.append(byte)
      index = next
    }
    return data
  }

  private static func code(for error: InAppMessages.Error) -> String {
    switch error {
    case .notConfigured:          return "NOT_CONFIGURED"
    case .messageNotFound:        return "MESSAGE_NOT_FOUND"
    case .bundleUnavailable:      return "BUNDLE_UNAVAILABLE"
    case .bridgeProtocolMismatch: return "BRIDGE_PROTOCOL_MISMATCH"
    }
  }

  private static func describe(_ error: InAppMessages.Error) -> String {
    switch error {
    case .notConfigured:
      return "Galva is not configured — call configureSDK() first."
    case .messageNotFound:
      return "The server no longer considers this message valid."
    case .bundleUnavailable:
      return "The WebView bundle for this message could not be downloaded."
    case .bridgeProtocolMismatch:
      return "This message needs a newer SDK bridge protocol — update @galva/react-native."
    }
  }
}
