//
//  GalvaLogBridge.swift
//  @galva/react-native
//
//  Forwards the vendored core's structured logs to JS as `galva#log` events, so
//  React Native developers can view SDK logs in their dev console and install a
//  custom JS logger that ships them to a remote server. Mirrors the iOS core's
//  own logging surface (GalvaLogger / Galva.LogEntry).
//
//  The core has ONE sink, installed via `Galva.setLogger`. To keep the default
//  os.Logger output (Console.app / Xcode) AND add JS forwarding, we install a
//  `MultiplexLogger([OSLogLogger, BridgeForwardLogger])`. Forwarding stays off
//  until JS calls `setLogForwarding(true)` — which the JS layer does only in dev
//  or when a custom logger is set — so release builds with no custom logger keep
//  the plain os.Logger sink and pay nothing.
//
//  Same pod module as the core, so this reaches the core's `GalvaLogger`,
//  `OSLogLogger`, and `Galva.LogEntry` directly (no import).
//

import Foundation

// MARK: - Composite sink

/// Fans one entry out to several sinks. `isEnabled` is the OR of its sinks, so an
/// always-on sink (os.Logger) keeps the upstream level filter delivering entries.
struct MultiplexLogger: GalvaLogger {
  let sinks: [any GalvaLogger]
  func log(_ entry: Galva.LogEntry) {
    for sink in sinks { sink.log(entry) }
  }
  func isEnabled(_ level: Galva.LogLevel) -> Bool {
    sinks.contains { $0.isEnabled(level) }
  }
}

/// The sink that hands entries to the JS bridge (a value type held by the core;
/// it routes through the shared `GalvaLogBridge` so it always reaches the live
/// module instance).
struct BridgeForwardLogger: GalvaLogger {
  func log(_ entry: Galva.LogEntry) { GalvaLogBridge.shared.forward(entry) }
  func isEnabled(_ level: Galva.LogLevel) -> Bool { GalvaLogBridge.shared.isActive }
}

// MARK: - Bridge

/// Bridges core logs → the RN event emitter. One shared instance so the
/// core-held `BridgeForwardLogger` always reaches the current module.
final class GalvaLogBridge: @unchecked Sendable {
  static let shared = GalvaLogBridge()
  private init() {}

  /// JS event name carrying each forwarded log entry. Matches the JS dispatcher.
  static let logEvent = "galva#log"

  private let lock = NSLock()
  private weak var module: GalvaModule?
  private var forwardingEnabled = false
  private var hasListeners = false
  private var installed = false

  /// Registered by the module on creation.
  func attach(_ module: GalvaModule) {
    lock.lock(); defer { lock.unlock() }
    self.module = module
  }

  /// Driven by start/stopObserving (any `galva#…` JS listener present).
  func setListening(_ listening: Bool) {
    lock.lock(); defer { lock.unlock() }
    hasListeners = listening
  }

  /// Driven by the `setLogForwarding` bridge method. Installs the multiplex
  /// logger once — the first time forwarding is turned on — so the default
  /// os.Logger sink is untouched until forwarding is actually requested.
  func setForwarding(_ enabled: Bool) {
    lock.lock()
    forwardingEnabled = enabled
    let needsInstall = enabled && !installed
    if needsInstall { installed = true }
    lock.unlock()
    if needsInstall {
      // Nonisolated entry; hops to the core actor internally — safe from here.
      Galva.setLogger(MultiplexLogger(sinks: [OSLogLogger(), BridgeForwardLogger()]))
    }
  }

  /// Whether entries should be serialized + sent (also gates `isEnabled`).
  var isActive: Bool {
    lock.lock(); defer { lock.unlock() }
    return forwardingEnabled && hasListeners && module != nil
  }

  /// Serialize + emit one entry to JS. No-op when inactive.
  func forward(_ entry: Galva.LogEntry) {
    lock.lock()
    let active = forwardingEnabled && hasListeners
    let mod = module
    lock.unlock()
    guard active, let mod else { return }
    mod.sendEvent(withName: Self.logEvent, body: Self.serialize(entry))
  }

  private static func serialize(_ entry: Galva.LogEntry) -> [String: Any] {
    var body: [String: Any] = [
      "level": levelName(entry.level),
      "category": entry.category.rawValue,
      "message": entry.message,
      "timestamp": entry.timestamp.timeIntervalSince1970 * 1000,
    ]
    if !entry.metadata.isEmpty { body["metadata"] = entry.metadata }
    if let error = entry.error { body["error"] = String(describing: error) }
    return body
  }

  private static func levelName(_ level: Galva.LogLevel) -> String {
    switch level {
    case .debug:   return "debug"
    case .info:    return "info"
    case .notice:  return "notice"
    case .warning: return "warning"
    case .error:   return "error"
    case .fault:   return "fault"
    case .off:     return "off"
    }
  }
}
