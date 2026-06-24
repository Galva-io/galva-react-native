//
//  GalvaModule.m
//  @galva/react-native
//
//  AUTO-GENERATED from src/native/GalvaNative.ts by scripts/gen-bridge.ts.
//  Do NOT edit by hand — run "npm run gen:bridge". "npm run check:bridge" fails
//  if this file is stale and verifies GalvaModule.swift exposes a matching
//  @objc(...) selector for every method. The example app's E2E smoke exercises
//  them against the real native module.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_REMAP_MODULE(Galva, GalvaModule, RCTEventEmitter)

RCT_EXTERN_METHOD(configureSDK:(NSDictionary *)options)

RCT_EXTERN_METHOD(setOptOut:(BOOL)enabled)

RCT_EXTERN_METHOD(isOptedOut:(RCTPromiseResolveBlock)resolve withRejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(reconcileTransactions)

RCT_EXTERN_METHOD(getSDKVersion:(RCTPromiseResolveBlock)resolve withRejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(trackEvent:(NSString *)eventName withAttributes:(nullable NSDictionary *)attributes)

RCT_EXTERN_METHOD(identifyUser:(NSString *)userId withAppAccountToken:(nullable NSString *)appAccountToken)

RCT_EXTERN_METHOD(logOut)

RCT_EXTERN_METHOD(getIdentifiedUserId:(RCTPromiseResolveBlock)resolve withRejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setUserAttributes:(NSDictionary *)attributes)

RCT_EXTERN_METHOD(registerAPNsToken:(NSString *)tokenHex)

RCT_EXTERN_METHOD(registerFCMToken:(NSString *)token)

RCT_EXTERN_METHOD(handleNotificationResponse:(NSDictionary *)payload)

RCT_EXTERN_METHOD(handleDeepLink:(NSString *)url withResolver:(RCTPromiseResolveBlock)resolve withRejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(showMessage:(NSString *)messageId withResolver:(RCTPromiseResolveBlock)resolve withRejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setLogForwarding:(BOOL)enabled)

@end
