#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// Map the Swift class `GalvaModule` → JS module name "Galva".
// REMAP (not plain RCT_EXTERN_MODULE) so the JS-facing name stays "Galva"
// while the Obj-C/Swift class avoids colliding with the vendored core's own
// `Galva` type (bridge and core compile into the same pod module).
@interface RCT_EXTERN_REMAP_MODULE(Galva, GalvaModule, RCTEventEmitter)

// --- Galva (configure & global controls) -----------------------------------

RCT_EXTERN_METHOD(configure:(NSDictionary *)options)

RCT_EXTERN_METHOD(setOptOut:(BOOL)enabled)

RCT_EXTERN_METHOD(isOptedOut:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setDeviceToken:(NSString *)token)

RCT_EXTERN_METHOD(reconcileTransactions)

RCT_EXTERN_METHOD(sdkVersion:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject)

// --- AppEvents --------------------------------------------------------------

RCT_EXTERN_METHOD(track:(NSString *)eventName
                  withAttributes:(NSDictionary * _Nullable)attributes)

// --- AppUser ------------------------------------------------------------------

RCT_EXTERN_METHOD(identify:(NSString *)userId
                  withAppAccountToken:(NSString * _Nullable)token)

RCT_EXTERN_METHOD(logout)

RCT_EXTERN_METHOD(identifiedUserId:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isAnonymous:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setEmail:(NSString *)email)

RCT_EXTERN_METHOD(setDisplayName:(NSString *)name)

RCT_EXTERN_METHOD(setUserProperty:(NSString *)key
                  withValue:(id)value)

RCT_EXTERN_METHOD(setUserProperties:(NSDictionary *)properties)

// --- Communication ------------------------------------------------------------

RCT_EXTERN_METHOD(isValidEmail:(NSString *)email
                  withResolver:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(registerEmail:(NSString *)email)

RCT_EXTERN_METHOD(unregisterEmail:(NSString *)email)

RCT_EXTERN_METHOD(registerPushToken:(NSString *)token
                  withPlatform:(NSString * _Nullable)platform)

RCT_EXTERN_METHOD(unregisterPushToken:(NSString *)token
                  withPlatform:(NSString * _Nullable)platform)

RCT_EXTERN_METHOD(setCommunicationPreference:(NSDictionary *)options)

// --- InAppMessages --------------------------------------------------------------

RCT_EXTERN_METHOD(checkForMessages)

RCT_EXTERN_METHOD(show:(NSString *)messageId
                  withResolver:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject)

@end
