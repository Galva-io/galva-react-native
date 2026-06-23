//
//  GalvaAutoWire.m
//  @galva/react-native
//
//  Zero-setup push auto-wiring for React Native. Swizzles two host delegate
//  methods so Galva sees push interactions without the developer forwarding
//  anything:
//
//    • UIApplicationDelegate
//        application:didRegisterForRemoteNotificationsWithDeviceToken:
//      → forwards the APNs token to the core.
//
//    • UNUserNotificationCenterDelegate
//        userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:
//      → forwards the tap/dismiss to the core for tracking.
//
//  Design notes:
//    • Installs on UIApplicationDidFinishLaunchingNotification (the app delegate
//      is set by then; the APNs token arrives later, after our swizzle is in
//      place). The UN delegate is instrumented both at that point and on every
//      future `setDelegate:` (libraries that assign it lazily).
//    • "Wrap or add": if the host implements a method (directly or inherited)
//      we chain to the original; if not, we add ours. We never mutate ancestor
//      classes, and we de-dupe per class so re-entry can't double-wrap.
//    • Completion-handler safety: for the UN response method we call the
//      original (which owns the handler) when one exists, and only call the
//      handler ourselves when we added the method.
//    • Opt-out: gated on `[GalvaAutoWire isEnabled]` (Info.plist
//      `GalvaSwizzlingEnabled`). When off, nothing is swizzled.
//

#import <Foundation/Foundation.h>
#import <objc/runtime.h>
#import <objc/message.h>
#import <UIKit/UIKit.h>
#import <UserNotifications/UserNotifications.h>

#import "GalvaAutoWireInstaller.h"

#pragma mark - Swift shim (forward declaration)

// Declared here rather than via the generated "-Swift.h" (awkward to import
// inside the pod). Selectors MUST match GalvaAutoWire.swift exactly.
@interface GalvaAutoWire : NSObject
+ (BOOL)isEnabled;
+ (void)forwardDeviceToken:(NSData *)tokenData;
+ (void)forwardNotificationResponse:(UNUserNotificationCenter *)center
                           response:(UNNotificationResponse *)response;
@end

#pragma mark - Replacement implementations

// application:didRegisterForRemoteNotificationsWithDeviceToken:
static void galva_didRegisterDeviceToken(id self, SEL _cmd, UIApplication *application, NSData *deviceToken) {
  [GalvaAutoWire forwardDeviceToken:deviceToken];
  SEL chain = @selector(galva_application:didRegisterForRemoteNotificationsWithDeviceToken:);
  if ([self respondsToSelector:chain]) {
    ((void (*)(id, SEL, UIApplication *, NSData *))objc_msgSend)(self, chain, application, deviceToken);
  }
}

// userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:
static void galva_didReceiveResponse(id self, SEL _cmd,
                                     UNUserNotificationCenter *center,
                                     UNNotificationResponse *response,
                                     void (^completionHandler)(void)) {
  [GalvaAutoWire forwardNotificationResponse:center response:response];
  SEL chain = @selector(galva_userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:);
  if ([self respondsToSelector:chain]) {
    ((void (*)(id, SEL, UNUserNotificationCenter *, UNNotificationResponse *, void (^)(void)))objc_msgSend)(
        self, chain, center, response, completionHandler);
  } else if (completionHandler) {
    // We added this method (the host didn't implement it), so we own the
    // completion handler and must call it exactly once.
    completionHandler();
  }
}

// UNUserNotificationCenter setDelegate: — instrument delegates assigned later.
static void (*galva_originalSetUNDelegate)(id, SEL, id) = NULL;
static void galva_setUNDelegate(id self, SEL _cmd, id delegate) {
  if (delegate) {
    [GalvaAutoWireInstaller instrumentNotificationDelegate:delegate];
  }
  if (galva_originalSetUNDelegate) {
    galva_originalSetUNDelegate(self, _cmd, delegate);
  }
}

#pragma mark - Runtime helpers

static BOOL galva_implementsDirectly(Class cls, SEL sel) {
  unsigned int count = 0;
  Method *methods = class_copyMethodList(cls, &count);
  BOOL found = NO;
  for (unsigned int i = 0; i < count; i++) {
    if (method_getName(methods[i]) == sel) {
      found = YES;
      break;
    }
  }
  if (methods) {
    free(methods);
  }
  return found;
}

// Install `newIMP` for `sel` on `cls`, preserving any existing implementation
// (direct or inherited) under `chainSel` so the replacement can chain to it.
static void galva_install(Class cls, SEL sel, SEL chainSel, IMP newIMP, const char *types) {
  Method existing = class_getInstanceMethod(cls, sel); // searches the hierarchy
  if (existing) {
    class_addMethod(cls, chainSel, method_getImplementation(existing), method_getTypeEncoding(existing));
    if (galva_implementsDirectly(cls, sel)) {
      method_setImplementation(class_getInstanceMethod(cls, sel), newIMP);
    } else {
      class_addMethod(cls, sel, newIMP, types); // override on cls; ancestor untouched
    }
  } else {
    class_addMethod(cls, sel, newIMP, types);
  }
}

#pragma mark - Installer

@implementation GalvaAutoWireInstaller

// Per-purpose set of class names already swizzled (de-dupe re-entry).
+ (NSMutableSet *)swizzledClassNamesForKey:(NSString *)key {
  static NSMutableDictionary *registry = nil;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    registry = [NSMutableDictionary dictionary];
  });
  NSMutableSet *set = registry[key];
  if (!set) {
    set = [NSMutableSet set];
    registry[key] = set;
  }
  return set;
}

+ (void)load {
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(applicationDidFinishLaunching:)
                                               name:UIApplicationDidFinishLaunchingNotification
                                             object:nil];
}

+ (void)applicationDidFinishLaunching:(NSNotification *)note {
  [[NSNotificationCenter defaultCenter] removeObserver:self
                                                  name:UIApplicationDidFinishLaunchingNotification
                                                object:nil];
  [self installForApplicationDelegate:[UIApplication sharedApplication].delegate
                 notificationDelegate:[UNUserNotificationCenter currentNotificationCenter].delegate];
}

// Gate + instrument. Extracted so tests can drive it with explicit fake
// delegates and toggle `GalvaAutoWire.isEnabled`. Production behavior is
// identical to the previous inline version.
+ (void)installForApplicationDelegate:(id)appDelegate
                 notificationDelegate:(id)notificationDelegate {
  if (![GalvaAutoWire isEnabled]) {
    return;
  }
  [self instrumentApplicationDelegate:appDelegate];
  [self swizzleNotificationCenterSetDelegate];
  [self instrumentNotificationDelegate:notificationDelegate];
}

// Clear the per-class de-dupe registry (test isolation). Does not un-swizzle.
+ (void)reset {
  [[self swizzledClassNamesForKey:@"appDelegate"] removeAllObjects];
  [[self swizzledClassNamesForKey:@"unDelegate"] removeAllObjects];
}

+ (void)instrumentApplicationDelegate:(id<UIApplicationDelegate>)delegate {
  if (!delegate) {
    return;
  }
  Class cls = [delegate class];
  NSString *name = NSStringFromClass(cls);
  NSMutableSet *done = [self swizzledClassNamesForKey:@"appDelegate"];
  if ([done containsObject:name]) {
    return;
  }
  [done addObject:name];
  galva_install(cls,
                @selector(application:didRegisterForRemoteNotificationsWithDeviceToken:),
                @selector(galva_application:didRegisterForRemoteNotificationsWithDeviceToken:),
                (IMP)galva_didRegisterDeviceToken,
                "v@:@@");
}

+ (void)instrumentNotificationDelegate:(id)delegate {
  if (!delegate) {
    return;
  }
  Class cls = [delegate class];
  NSString *name = NSStringFromClass(cls);
  NSMutableSet *done = [self swizzledClassNamesForKey:@"unDelegate"];
  if ([done containsObject:name]) {
    return;
  }
  [done addObject:name];
  galva_install(cls,
                @selector(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:),
                @selector(galva_userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:),
                (IMP)galva_didReceiveResponse,
                "v@:@@@?");
}

+ (void)swizzleSetDelegateOnClass:(Class)cls {
  // Idempotent per class. (Only one class — UNUserNotificationCenter — is
  // swizzled in production; the generic form exists so tests can exercise the
  // setter-swizzle against a stand-in class without an app bundle.)
  NSMutableSet *done = [self swizzledClassNamesForKey:@"setDelegate"];
  NSString *name = NSStringFromClass(cls);
  if ([done containsObject:name]) {
    return;
  }
  [done addObject:name];
  Method m = class_getInstanceMethod(cls, @selector(setDelegate:));
  if (!m) {
    return;
  }
  galva_originalSetUNDelegate = (void (*)(id, SEL, id))method_getImplementation(m);
  method_setImplementation(m, (IMP)galva_setUNDelegate);
}

+ (void)swizzleNotificationCenterSetDelegate {
  [self swizzleSetDelegateOnClass:[UNUserNotificationCenter class]];
}

@end
