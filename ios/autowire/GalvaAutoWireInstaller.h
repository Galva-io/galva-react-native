//
//  GalvaAutoWireInstaller.h
//  @galva/react-native
//
//  Interface for the push auto-wiring installer. The class methods are exposed
//  (beyond what production strictly calls) so the swizzling behavior can be
//  driven deterministically from unit tests with explicit, fake delegates —
//  see GalvaAutoWireTests. Project (non-public) header: not in the pod umbrella,
//  so it never collides with the generated Galva-Swift.h.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface GalvaAutoWireInstaller : NSObject

/// Gate + instrument. When `GalvaAutoWire.isEnabled`, instruments the app
/// delegate (APNs token), swizzles `UNUserNotificationCenter.setDelegate:`, and
/// instruments the notification delegate. Called on launch with the real
/// delegates; called by tests with fakes.
+ (void)installForApplicationDelegate:(nullable id)appDelegate
                 notificationDelegate:(nullable id)notificationDelegate;

/// Instrument one app delegate's `didRegisterForRemoteNotifications…`.
+ (void)instrumentApplicationDelegate:(nullable id)delegate;

/// Instrument one UN delegate's `didReceiveNotificationResponse…`.
+ (void)instrumentNotificationDelegate:(nullable id)delegate;

/// Swizzle `setDelegate:` on a class so delegates assigned later are
/// instrumented. Generic (takes the class) so tests can drive it with a
/// stand-in center, avoiding UNUserNotificationCenter's app-bundle requirement.
+ (void)swizzleSetDelegateOnClass:(Class)cls;

/// Swizzle `UNUserNotificationCenter.setDelegate:` so late delegates are caught.
+ (void)swizzleNotificationCenterSetDelegate;

/// Clear the per-class de-dupe registry (test isolation). Does not un-swizzle.
+ (void)reset;

@end

NS_ASSUME_NONNULL_END
