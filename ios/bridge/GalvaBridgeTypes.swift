//
//  GalvaBridgeTypes.swift
//  @galva/react-native
//
//  AUTO-GENERATED from src/native/GalvaNative.ts by scripts/gen-bridge.ts.
//  Do NOT edit by hand — run "npm run gen:bridge". "npm run check:bridge" fails
//  if this file is stale.
//
//  Decodable mirrors of the JS object payloads, so the Swift bridge parses them
//  confidently (see GalvaBridgeDecoding.swift for the NSDictionary → struct
//  helper). A field renamed/added in GalvaNative.ts changes these types, which
//  surfaces as a compile error in the bridge mappers — not a silent runtime drop.
//

import Foundation

struct NativeGalvaConfigEnvironmentCustom: Decodable {
    let apiBaseURL: String
    let webviewBundleCDN: String
}

enum NativeGalvaConfigEnvironment: Decodable {
    case named(String)
    case custom(NativeGalvaConfigEnvironmentCustom)

    init(from decoder: Decoder) throws {
        if let single = try? decoder.singleValueContainer(),
           let value = try? single.decode(String.self) {
            self = .named(value)
            return
        }
        self = .custom(try NativeGalvaConfigEnvironmentCustom(from: decoder))
    }
}

struct NativeGalvaConfigAutoTrack: Decodable {
    let lifecycle: Bool?
    let appleSearchAds: Bool?
}

struct NativeGalvaConfig: Decodable {
    let apiKey: String
    let environment: NativeGalvaConfigEnvironment?
    let logLevel: String?
    let autoTrack: NativeGalvaConfigAutoTrack?
}

enum NativeNotificationResponseAction: String, Decodable {
    case `default`
    case dismiss
}

struct NativeNotificationResponse: Decodable {
    let id: String
    let userInfo: [String: AnyJSONValue]
    let action: NativeNotificationResponseAction?
}
