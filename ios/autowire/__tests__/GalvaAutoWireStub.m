//
//  GalvaAutoWireStub.m  (TEST-ONLY — excluded from the pod)
//
//  Recording replacement for the production GalvaAutoWire Swift shim. The real
//  swizzler (GalvaAutoWire.m) calls `[GalvaAutoWire forward…]`; in the unit-test
//  bundle those calls land here instead of the Galva core, so a test can assert
//  exactly what the swizzle forwarded — with no Pods, no core, no React.
//

#import <Foundation/Foundation.h>
#import <UserNotifications/UserNotifications.h>

@interface GalvaAutoWire : NSObject
+ (BOOL)isEnabled;
+ (void)forwardDeviceToken:(NSData *)tokenData;
+ (void)forwardNotificationResponse:(UNUserNotificationCenter *)center
                           response:(UNNotificationResponse *)response;
// Test controls.
+ (void)test_reset;
+ (void)test_setEnabled:(BOOL)enabled;
+ (NSData *)test_lastDeviceToken;
+ (NSUInteger)test_deviceTokenForwardCount;
+ (NSUInteger)test_responseForwardCount;
@end

@implementation GalvaAutoWire

static BOOL sEnabled = YES;
static NSData *sLastToken = nil;
static NSUInteger sTokenCount = 0;
static NSUInteger sResponseCount = 0;

+ (BOOL)isEnabled {
  return sEnabled;
}

+ (void)forwardDeviceToken:(NSData *)tokenData {
  sLastToken = tokenData;
  sTokenCount++;
}

+ (void)forwardNotificationResponse:(UNUserNotificationCenter *)center
                           response:(UNNotificationResponse *)response {
  sResponseCount++;
}

+ (void)test_reset {
  sEnabled = YES;
  sLastToken = nil;
  sTokenCount = 0;
  sResponseCount = 0;
}

+ (void)test_setEnabled:(BOOL)enabled { sEnabled = enabled; }
+ (NSData *)test_lastDeviceToken { return sLastToken; }
+ (NSUInteger)test_deviceTokenForwardCount { return sTokenCount; }
+ (NSUInteger)test_responseForwardCount { return sResponseCount; }

@end
