//
//  GalvaModule.m
//  @galva/react-native
//
//  Registers the Swift `GalvaModule` with React Native as "Galva" and declares
//  its JS-callable methods. Using the legacy RCT_EXTERN macros (not codegen)
//  keeps one module working across RN 0.70 → 0.8x on both architectures.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_REMAP_MODULE(Galva, GalvaModule, RCTEventEmitter)

// Configure & lifecycle
RCT_EXTERN_METHOD(configureSDK:(NSDictionary *)options)
RCT_EXTERN_METHOD(setOptOut:(BOOL)enabled)
RCT_EXTERN_METHOD(isOptedOut:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(reconcileTransactions)
RCT_EXTERN_METHOD(getSDKVersion:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject)

// Events
RCT_EXTERN_METHOD(trackEvent:(NSString *)eventName
                  withAttributes:(nullable NSDictionary *)attributes)

// Identity
RCT_EXTERN_METHOD(identifyUser:(NSString *)userId
                  withAppAccountToken:(nullable NSString *)token)
RCT_EXTERN_METHOD(logOut)
RCT_EXTERN_METHOD(getIdentifiedUserId:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setUserAttributes:(NSDictionary *)attributes)

// Push (escape hatches)
RCT_EXTERN_METHOD(registerAPNsToken:(NSString *)tokenHex)
RCT_EXTERN_METHOD(registerFCMToken:(NSString *)token)
RCT_EXTERN_METHOD(handleNotificationResponse:(NSDictionary *)payload)

// Deep links
RCT_EXTERN_METHOD(handleDeepLink:(NSString *)url
                  withResolver:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject)

// In-app messages
RCT_EXTERN_METHOD(showMessage:(NSString *)messageId
                  withResolver:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject)

@end
