//
//  GalvaE2ECompetitorSwizzler.h  (TEST-ONLY)
//
//  A faithful stand-in for a third-party push SDK that swizzles the same two
//  delegate methods Galva does (OneSignal / Firebase Messaging do exactly this).
//  It uses the classic `method_exchangeImplementations` technique with chaining,
//  so the app-hosted E2E can prove that Galva and another live swizzler coexist
//  on the same delegate — in either load order — without dropping each other's
//  calls or mishandling the notification completion handler.
//
//  Counters record how often the competitor's own implementations ran, so the
//  test can assert all three links of the chain (host + Galva + competitor) fire.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface GalvaE2ECompetitorSwizzler : NSObject

/// Swizzle `application:didRegisterForRemoteNotificationsWithDeviceToken:` on
/// `cls`, OneSignal-style: install our impl under a private selector and exchange
/// it with the original (chaining to whatever was there). If the class doesn't
/// implement the method, add ours directly.
+ (void)swizzleAppDelegateClass:(Class)cls;

/// Swizzle `userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:`
/// on `cls` the same way. Our impl chains (passing the completion handler along)
/// when an original exists, and only owns the handler when it added the method.
+ (void)swizzleUNDelegateClass:(Class)cls;

/// Times the competitor's token impl ran (since the last reset).
+ (NSUInteger)tokenForwardCount;
/// Times the competitor's notification-response impl ran (since the last reset).
+ (NSUInteger)responseForwardCount;
/// Reset both counters (test isolation). Does not un-swizzle.
+ (void)resetCounters;

@end

NS_ASSUME_NONNULL_END
