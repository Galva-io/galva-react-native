//
//  GalvaE2ECompetitorSwizzler.m  (TEST-ONLY)
//
//  See the header. This models a well-behaved third-party push SDK swizzler:
//  method_exchangeImplementations + chaining. The point of testing against it is
//  that exchange-based swizzling and Galva's add/setImplementation-based swizzling
//  must compose cleanly in BOTH orders:
//
//    • competitor-then-Galva: Galva sees the competitor's impl as "the original"
//      and chains to it; the competitor in turn chains to the host's original.
//    • Galva-then-competitor: the competitor exchanges Galva's installed impl,
//      so calling the method runs competitor → Galva → host (or the reverse),
//      every link still firing exactly once.
//

#import "GalvaE2ECompetitorSwizzler.h"
#import <objc/runtime.h>
#import <objc/message.h>

static NSUInteger gTokenCalls;
static NSUInteger gResponseCalls;

#pragma mark - Competitor implementations (record + chain)

// application:didRegisterForRemoteNotificationsWithDeviceToken:
static void comp_token(id self, SEL _cmd, id application, NSData *token) {
  gTokenCalls++;
  SEL chain = @selector(onesignalish_application:didRegisterForRemoteNotificationsWithDeviceToken:);
  if ([self respondsToSelector:chain]) {
    ((void (*)(id, SEL, id, NSData *))objc_msgSend)(self, chain, application, token);
  }
}

// userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:
static void comp_response(id self, SEL _cmd, id center, id response, void (^completionHandler)(void)) {
  gResponseCalls++;
  SEL chain = @selector(onesignalish_userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:);
  if ([self respondsToSelector:chain]) {
    ((void (*)(id, SEL, id, id, void (^)(void)))objc_msgSend)(self, chain, center, response, completionHandler);
  } else if (completionHandler) {
    // We added the method (no original to chain to), so we own the handler.
    completionHandler();
  }
}

#pragma mark - Swizzle install (classic exchange)

static void swizzle(Class cls, SEL original, SEL replacement, IMP impl, const char *types) {
  Method origM = class_getInstanceMethod(cls, original);
  if (origM) {
    // Install our impl under a private selector, then swap it with the original.
    class_addMethod(cls, replacement, impl, method_getTypeEncoding(origM));
    Method replM = class_getInstanceMethod(cls, replacement);
    method_exchangeImplementations(origM, replM);
  } else {
    // Host doesn't implement it — add ours directly (nothing to chain to).
    class_addMethod(cls, original, impl, types);
  }
}

@implementation GalvaE2ECompetitorSwizzler

+ (void)swizzleAppDelegateClass:(Class)cls {
  swizzle(cls,
          @selector(application:didRegisterForRemoteNotificationsWithDeviceToken:),
          @selector(onesignalish_application:didRegisterForRemoteNotificationsWithDeviceToken:),
          (IMP)comp_token,
          "v@:@@");
}

+ (void)swizzleUNDelegateClass:(Class)cls {
  swizzle(cls,
          @selector(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:),
          @selector(onesignalish_userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:),
          (IMP)comp_response,
          "v@:@@@?");
}

+ (NSUInteger)tokenForwardCount {
  return gTokenCalls;
}

+ (NSUInteger)responseForwardCount {
  return gResponseCalls;
}

+ (void)resetCounters {
  gTokenCalls = 0;
  gResponseCalls = 0;
}

@end
