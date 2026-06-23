//
//  GalvaAutoWire.swift
//  @galva/react-native
//
//  Swift shim the Obj-C swizzler (GalvaAutoWire.m) calls into. The swizzler is
//  written in Obj-C (the natural language for ObjC-runtime work) and can't call
//  the core's pure-Swift `Galva` API directly, so this @objc class exposes the
//  two forwards it needs plus the opt-out gate. Both live in the same pod
//  module, so this calls the vendored core (Galva) without an import.
//
//  Auto-wiring is ON by default (zero-setup push for RN apps). Opt out by
//  setting `GalvaSwizzlingEnabled` to NO in Info.plist — the Expo config plugin
//  exposes this as a prop; bare apps set the key directly. When off, use the JS
//  escape hatches (registerAPNsToken / handleNotificationResponse).
//

import Foundation

#if canImport(UIKit)
import UIKit
#endif
#if canImport(UserNotifications)
import UserNotifications
#endif

@objc(GalvaAutoWire)
final class GalvaAutoWire: NSObject {

  /// Default ON. Opt out via Info.plist `GalvaSwizzlingEnabled = NO`.
  @objc static var isEnabled: Bool {
    (Bundle.main.object(forInfoDictionaryKey: "GalvaSwizzlingEnabled") as? Bool) ?? true
  }

  /// Forward the raw APNs device token captured from the app delegate.
  @objc static func forwardDeviceToken(_ tokenData: Data) {
    Galva.applicationDidRegisterForRemoteNotificationsWithDeviceToken(tokenData)
    Self.didForward(Self.didForwardDeviceTokenNotification)
  }

  #if canImport(UserNotifications)
  /// Forward a notification response captured from the UN center delegate. The
  /// core tracks only Galva-originated notifications and ignores the rest.
  @objc static func forwardNotificationResponse(
    _ center: UNUserNotificationCenter,
    response: UNNotificationResponse
  ) {
    Galva.userNotificationCenter(center, didReceive: response)
    Self.didForward(Self.didForwardNotificationResponseNotification)
  }
  #endif

  // MARK: - Test observation seam (DEBUG only — zero footprint in release)
  //
  // The app-hosted swizzler E2E (example/ios/GalvaExampleTests) drives the real
  // swizzled delegate methods on the real app/UN delegates and needs to confirm
  // that *this* shim actually ran the forward — not just that nothing crashed.
  // In DEBUG we post a notification after each forward; the test counts them.
  // Compiled out entirely in release, so production carries no observer, no
  // post, no branch. The names are matched verbatim by the E2E.

  /// Posted (DEBUG only) after a device token is forwarded to the core.
  static let didForwardDeviceTokenNotification = "GalvaAutoWireDidForwardDeviceToken"
  /// Posted (DEBUG only) after a notification response is forwarded to the core.
  static let didForwardNotificationResponseNotification = "GalvaAutoWireDidForwardNotificationResponse"

  private static func didForward(_ name: String) {
    #if DEBUG
    NotificationCenter.default.post(name: Notification.Name(name), object: nil)
    #endif
  }
}
