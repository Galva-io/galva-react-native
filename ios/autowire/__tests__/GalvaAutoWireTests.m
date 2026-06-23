//
//  GalvaAutoWireTests.m  (TEST-ONLY — excluded from the pod)
//
//  Deterministic proof that the push auto-wiring swizzler is safe: it forwards
//  what it should, never drops a host's own delegate method, calls a
//  notification completion handler exactly once, is idempotent, respects the
//  opt-out gate, and catches delegates assigned later (coexistence with other
//  push libraries). Each case uses a freshly-minted runtime class so there is
//  no cross-test swizzle carryover.
//

#import <XCTest/XCTest.h>
#import <UIKit/UIKit.h>
#import <UserNotifications/UserNotifications.h>
#import <objc/runtime.h>
#import <objc/message.h>
#import "GalvaAutoWireInstaller.h"

// GalvaAutoWire itself is defined by the recording stub (GalvaAutoWireStub.m);
// declare just the test controls we call here so this TU can reach them.
@interface GalvaAutoWire : NSObject
+ (void)test_reset;
+ (void)test_setEnabled:(BOOL)enabled;
+ (NSUInteger)test_deviceTokenForwardCount;
+ (NSUInteger)test_responseForwardCount;
@end

// Host-side recorders — distinct from Galva's forwards, so we can prove the
// host's own implementation still runs (chaining) and completion-handler counts.
static NSUInteger gHostTokenCalls;
static NSUInteger gHostResponseCalls;
static NSUInteger gCompletionCalls;

static void host_didRegister(id self, SEL _cmd, id application, NSData *token) {
  gHostTokenCalls++;
}
static void host_didReceiveResponse(id self, SEL _cmd, id center, id response,
                                    void (^completionHandler)(void)) {
  gHostResponseCalls++;
  if (completionHandler) completionHandler();
}

// Stand-in for UNUserNotificationCenter's own setDelegate: (records the
// delegate), so the setter-swizzle can be exercised without an app bundle.
static id gFakeStoredDelegate;
static void fakecenter_setDelegate(id self, SEL _cmd, id delegate) {
  gFakeStoredDelegate = delegate;
}

static SEL TokenSel(void) {
  return sel_registerName("application:didRegisterForRemoteNotificationsWithDeviceToken:");
}
static SEL RespSel(void) {
  return sel_registerName("userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:");
}

@interface GalvaAutoWireTests : XCTestCase
@end

@implementation GalvaAutoWireTests {
  int _counter;
}

- (void)setUp {
  [super setUp];
  gHostTokenCalls = gHostResponseCalls = gCompletionCalls = 0;
  [GalvaAutoWire test_reset];
  [GalvaAutoWireInstaller reset];
}

#pragma mark - helpers

- (Class)makeDelegateWithSuper:(Class)sup token:(BOOL)token response:(BOOL)response {
  NSString *raw = [NSString stringWithFormat:@"GalvaTestDelegate_%d_%u", ++_counter, arc4random()];
  Class c = objc_allocateClassPair(sup ?: [NSObject class], raw.UTF8String, 0);
  if (token) class_addMethod(c, TokenSel(), (IMP)host_didRegister, "v@:@@");
  if (response) class_addMethod(c, RespSel(), (IMP)host_didReceiveResponse, "v@:@@@?");
  objc_registerClassPair(c);
  return c;
}

- (void)invokeTokenOn:(id)instance {
  NSData *token = [@"tok" dataUsingEncoding:NSUTF8StringEncoding];
  ((void (*)(id, SEL, id, NSData *))objc_msgSend)(instance, TokenSel(), nil, token);
}

- (void)invokeResponseOn:(id)instance {
  ((void (*)(id, SEL, id, id, void (^)(void)))objc_msgSend)(
      instance, RespSel(), nil, nil, ^{ gCompletionCalls++; });
}

#pragma mark - 1. opt-out gate

- (void)test_disabled_doesNotInstrument {
  [GalvaAutoWire test_setEnabled:NO];
  id instance = [[self makeDelegateWithSuper:nil token:NO response:NO] new];
  [GalvaAutoWireInstaller installForApplicationDelegate:instance notificationDelegate:nil];
  XCTAssertFalse([instance respondsToSelector:TokenSel()], @"disabled: must not add the token method");
  XCTAssertEqual([GalvaAutoWire test_deviceTokenForwardCount], 0u);
}

- (void)test_enabled_installsViaGate {
  id instance = [[self makeDelegateWithSuper:nil token:NO response:NO] new];
  [GalvaAutoWireInstaller installForApplicationDelegate:instance notificationDelegate:nil];
  XCTAssertTrue([instance respondsToSelector:TokenSel()], @"enabled: token method installed");
  [self invokeTokenOn:instance];
  XCTAssertEqual([GalvaAutoWire test_deviceTokenForwardCount], 1u);
}

#pragma mark - 2. host implements → chains + forwards

- (void)test_hostImplements_chainsAndForwards {
  id instance = [[self makeDelegateWithSuper:nil token:YES response:NO] new];
  [GalvaAutoWireInstaller instrumentApplicationDelegate:instance];
  [self invokeTokenOn:instance];
  XCTAssertEqual([GalvaAutoWire test_deviceTokenForwardCount], 1u, @"Galva forwarded once");
  XCTAssertEqual(gHostTokenCalls, 1u, @"host's original ran (chained) exactly once");
}

#pragma mark - 3. host missing → adds + forwards

- (void)test_hostMissing_addsAndForwards {
  id instance = [[self makeDelegateWithSuper:nil token:NO response:NO] new];
  [GalvaAutoWireInstaller instrumentApplicationDelegate:instance];
  XCTAssertTrue([instance respondsToSelector:TokenSel()], @"method added");
  [self invokeTokenOn:instance];
  XCTAssertEqual([GalvaAutoWire test_deviceTokenForwardCount], 1u);
  XCTAssertEqual(gHostTokenCalls, 0u, @"no host original existed");
}

#pragma mark - 4. inherited impl → chains, ancestor untouched

- (void)test_inheritedImpl_chainsWithoutMutatingAncestor {
  Class base = [self makeDelegateWithSuper:nil token:YES response:NO];
  IMP ancestorIMP = class_getMethodImplementation(base, TokenSel());
  Class child = objc_allocateClassPair(base, [NSString stringWithFormat:@"child_%u", arc4random()].UTF8String, 0);
  objc_registerClassPair(child);

  [GalvaAutoWireInstaller instrumentApplicationDelegate:[child new]];
  [self invokeTokenOn:[child new]];

  XCTAssertEqual([GalvaAutoWire test_deviceTokenForwardCount], 1u);
  XCTAssertEqual(gHostTokenCalls, 1u, @"chained to the inherited (ancestor) implementation");
  XCTAssertEqual(class_getMethodImplementation(base, TokenSel()), ancestorIMP,
                 @"ancestor class must NOT be mutated");
}

#pragma mark - 5. UN host implements → completion exactly once

- (void)test_un_hostImplements_chainsCompletionOnce {
  id instance = [[self makeDelegateWithSuper:nil token:NO response:YES] new];
  [GalvaAutoWireInstaller instrumentNotificationDelegate:instance];
  [self invokeResponseOn:instance];
  XCTAssertEqual([GalvaAutoWire test_responseForwardCount], 1u, @"Galva forwarded once");
  XCTAssertEqual(gHostResponseCalls, 1u, @"host's original ran once");
  XCTAssertEqual(gCompletionCalls, 1u, @"completion handler called EXACTLY once");
}

#pragma mark - 6. UN host missing → Galva owns completion, once

- (void)test_un_hostMissing_callsCompletionOnce {
  id instance = [[self makeDelegateWithSuper:nil token:NO response:NO] new];
  [GalvaAutoWireInstaller instrumentNotificationDelegate:instance];
  XCTAssertTrue([instance respondsToSelector:RespSel()], @"method added");
  [self invokeResponseOn:instance];
  XCTAssertEqual([GalvaAutoWire test_responseForwardCount], 1u);
  XCTAssertEqual(gCompletionCalls, 1u, @"Galva calls completion exactly once when it owns the method");
}

#pragma mark - 7. idempotent (no double-wrap)

- (void)test_idempotent_noDoubleWrap {
  id instance = [[self makeDelegateWithSuper:nil token:YES response:NO] new];
  [GalvaAutoWireInstaller instrumentApplicationDelegate:instance];
  [GalvaAutoWireInstaller instrumentApplicationDelegate:instance]; // twice, no reset
  [self invokeTokenOn:instance];
  XCTAssertEqual([GalvaAutoWire test_deviceTokenForwardCount], 1u, @"forwarded once despite double instrument");
  XCTAssertEqual(gHostTokenCalls, 1u, @"host ran once (not double-wrapped)");
}

#pragma mark - 8. coexistence: late-assigned delegate is instrumented + still set

- (void)test_setDelegateSwizzle_instrumentsLateAndChains {
  gFakeStoredDelegate = nil;
  // Stand-in center class with its own setDelegate: that records the delegate —
  // models a push library assigning the notification delegate after launch.
  Class fakeCenter = objc_allocateClassPair(
      [NSObject class], [NSString stringWithFormat:@"GalvaFakeCenter_%u", arc4random()].UTF8String, 0);
  class_addMethod(fakeCenter, @selector(setDelegate:), (IMP)fakecenter_setDelegate, "v@:@");
  objc_registerClassPair(fakeCenter);

  [GalvaAutoWireInstaller swizzleSetDelegateOnClass:fakeCenter];

  id center = [fakeCenter new];
  id delegate = [[self makeDelegateWithSuper:nil token:NO response:YES] new];
  ((void (*)(id, SEL, id))objc_msgSend)(center, @selector(setDelegate:), delegate); // late assignment

  XCTAssertEqual(gFakeStoredDelegate, delegate, @"host's original setDelegate: still ran (delegate stored)");
  [self invokeResponseOn:delegate];
  XCTAssertEqual([GalvaAutoWire test_responseForwardCount], 1u, @"late-assigned delegate got instrumented");
  XCTAssertEqual(gHostResponseCalls, 1u, @"its host response impl still chains");
  XCTAssertEqual(gCompletionCalls, 1u, @"completion handler called exactly once");
}

@end
