//
//  GalvaBridgeDecoding.swift
//  @galva/react-native
//
//  Hand-written plumbing for the generated GalvaBridgeTypes.swift: decode an RN
//  bridge payload (an already-deserialized JS object, delivered as NSDictionary)
//  into a generated Decodable struct, and convert the core's `AnyJSONValue` back
//  to a Foundation value for the `[String: Any]` core helpers.
//
//  Same pod module as the core, so `AnyJSONValue` is reachable directly.
//

import Foundation

extension Decodable {
  /// Decode `Self` from a bridge payload NSDictionary. Returns `nil` if the
  /// dictionary isn't valid JSON or doesn't match the generated type.
  static func fromBridgePayload(_ dictionary: NSDictionary) -> Self? {
    guard
      JSONSerialization.isValidJSONObject(dictionary),
      let data = try? JSONSerialization.data(withJSONObject: dictionary)
    else { return nil }
    return try? JSONDecoder().decode(Self.self, from: data)
  }
}

extension AnyJSONValue {
  /// Convert back to a Foundation `Any` for the core's `[String: Any]` helpers
  /// (e.g. `NotificationResponse.attributes`). Inverse of `AnyJSONValue.coercing`.
  var unwrapped: Any {
    switch self {
    case .null: return NSNull()
    case .bool(let value): return value
    case .int(let value): return value
    case .double(let value): return value
    case .string(let value): return value
    case .array(let value): return value.map(\.unwrapped)
    case .object(let value): return value.mapValues(\.unwrapped)
    }
  }
}
