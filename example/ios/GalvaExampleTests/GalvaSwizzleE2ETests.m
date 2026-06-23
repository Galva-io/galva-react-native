//
//  GalvaSwizzleE2ETests.m  (app-hosted E2E)
//
//  Real-world proof that the push auto-wiring swizzler is safe — running inside
//  the actual example app, through the actual application lifecycle, against the
//  REAL Galva pod (not a stub), and alongside a SECOND live swizzler that hooks
//  the same delegate methods the way OneSignal / Firebase Messaging do.
//
//  This is the layer the deterministic unit tests (ios/autowire/__tests__) can't
//  reach: those run in a logic bundle with synthetic classes and a recording
//  stub. Here:
//
//    • The host is the real RN app. `UIApplicationMain` set the app delegate and
//      UIKit posted UIApplicationDidFinishLaunchingNotification, so Galva's
//      +load → applicationDidFinishLaunching: install ran for real. We assert it
//      instrumented the real app delegate and that the real shim forwards.
//    • The real UNUserNotificationCenter exists, so the real setDelegate: swizzle
//      (installed at launch) is exercised against a genuinely late-assigned
//      delegate, and we drive a REAL UNNotificationResponse through it.
//    • A real competitor swizzler coexists on the same methods, in BOTH load
//      orders, and we assert host + Galva + competitor each fire exactly once
//      and the notification completion handler is called exactly once.
//
//  Whether Galva's *own* forward ran is observed via a DEBUG-only notification
//  posted by GalvaAutoWire.forward… (see GalvaAutoWire.swift) — so we confirm the
//  real core path executed, not merely that nothing crashed.
//
//  Enable vs disable: the opt-out gate reads Info.plist at process start and
//  can't be flipped mid-run, so the *disabled* path is proven deterministically
//  by the unit tests. This suite proves the *enabled* path in a real app — the
//  example ships without GalvaSwizzlingEnabled, i.e. the default-on case.
//

#import <XCTest/XCTest.h>
#import <UIKit/UIKit.h>
#import <UserNotifications/UserNotifications.h>
#import <objc/runtime.h>
#import <objc/message.h>

#import "GalvaE2ECompetitorSwizzler.h"

// Resolved from the host app at runtime (the Galva pod is linked into the app;
// this is a project header, not in the pod umbrella, so we re-declare what we
// call — same pattern as the unit tests).
@interface GalvaAutoWireInstaller : NSObject
+ (void)instrumentApplicationDelegate:(nullable id)delegate;
+ (void)instrumentNotificationDelegate:(nullable id)delegate;
+ (void)reset;
@end

// Names posted by the real Swift shim's DEBUG observation seam.
static NSString *const kGalvaDidForwardToken = @"GalvaAutoWireDidForwardDeviceToken";
static NSString *const kGalvaDidForwardResponse = @"GalvaAutoWireDidForwardNotificationResponse";

#pragma mark - Host-side recorders

// Distinct from Galva's and the competitor's forwards, so we can prove the
// host's own delegate implementation still runs (the chain isn't dropped).
static NSUInteger gHostTokenCalls;
static NSUInteger gHostResponseCalls;
static NSUInteger gCompletionCalls;
// Galva forward counts (incremented by the DEBUG-notification observers).
static NSUInteger gGalvaTokenForwards;
static NSUInteger gGalvaResponseForwards;

static void host_didRegister(id self, SEL _cmd, id application, NSData *token) {
  gHostTokenCalls++;
}
static void host_didReceiveResponse(id self, SEL _cmd, id center, id response,
                                    void (^completionHandler)(void)) {
  gHostResponseCalls++;
  if (completionHandler) completionHandler();  // host owns the handler (terminal)
}

static SEL TokenSel(void) {
  return @selector(application:didRegisterForRemoteNotificationsWithDeviceToken:);
}
static SEL RespSel(void) {
  return @selector(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:);
}

// Build a REAL UNNotificationResponse. UNNotificationResponse / UNNotification
// have no public initializer, so tests use the documented private factory
// methods (allowed in test code). Returns nil if the runtime shape ever changes
// — callers assert non-nil so a break is loud, not silent.
static UNNotificationResponse *MakeResponse(NSDictionary *userInfo, NSString *actionIdentifier) {
  UNMutableNotificationContent *content = [[UNMutableNotificationContent alloc] init];
  content.userInfo = userInfo ?: @{};
  UNNotificationRequest *request = [UNNotificationRequest requestWithIdentifier:@"galva-e2e"
                                                                        content:content
                                                                        trigger:nil];
  Class notifCls = NSClassFromString(@"UNNotification");
  SEL notifSel = NSSelectorFromString(@"notificationWithRequest:date:");
  UNNotification *notification = nil;
  if (notifCls && [notifCls respondsToSelector:notifSel]) {
    notification = ((UNNotification *(*)(id, SEL, UNNotificationRequest *, NSDate *))objc_msgSend)(
        notifCls, notifSel, request, [NSDate date]);
  }
  Class respCls = NSClassFromString(@"UNNotificationResponse");
  SEL respSel = NSSelectorFromString(@"responseWithNotification:actionIdentifier:");
  if (notification && respCls && [respCls respondsToSelector:respSel]) {
    return ((UNNotificationResponse *(*)(id, SEL, UNNotification *, NSString *))objc_msgSend)(
        respCls, respSel, notification, actionIdentifier);
  }
  return nil;
}

@interface GalvaSwizzleE2ETests : XCTestCase
@end

@implementation GalvaSwizzleE2ETests {
  int _counter;
  id _tokenObserver;
  id _responseObserver;
}

- (void)setUp {
  [super setUp];
  gHostTokenCalls = gHostResponseCalls = gCompletionCalls = 0;
  gGalvaTokenForwards = gGalvaResponseForwards = 0;
  [GalvaE2ECompetitorSwizzler resetCounters];
  // Clear Galva's per-class de-dupe so each test's freshly-minted delegate class
  // gets instrumented. Does NOT un-swizzle the real app/UN delegates from launch.
  [GalvaAutoWireInstaller reset];

  __weak typeof(self) weakSelf = self;
  (void)weakSelf;
  _tokenObserver = [[NSNotificationCenter defaultCenter]
      addObserverForName:kGalvaDidForwardToken object:nil queue:nil
              usingBlock:^(NSNotification *_) { gGalvaTokenForwards++; }];
  _responseObserver = [[NSNotificationCenter defaultCenter]
      addObserverForName:kGalvaDidForwardResponse object:nil queue:nil
              usingBlock:^(NSNotification *_) { gGalvaResponseForwards++; }];
}

- (void)tearDown {
  if (_tokenObserver) [[NSNotificationCenter defaultCenter] removeObserver:_tokenObserver];
  if (_responseObserver) [[NSNotificationCenter defaultCenter] removeObserver:_responseObserver];
  _tokenObserver = _responseObserver = nil;
  [super tearDown];
}

#pragma mark - helpers

- (Class)makeDelegateClassWithToken:(BOOL)token response:(BOOL)response {
  NSString *raw = [NSString stringWithFormat:@"GalvaE2EDelegate_%d_%u", ++_counter, arc4random()];
  Class c = objc_allocateClassPair([NSObject class], raw.UTF8String, 0);
  if (token) class_addMethod(c, TokenSel(), (IMP)host_didRegister, "v@:@@");
  if (response) class_addMethod(c, RespSel(), (IMP)host_didReceiveResponse, "v@:@@@?");
  objc_registerClassPair(c);
  return c;
}

- (void)invokeTokenOn:(id)instance {
  NSData *token = [@"e2e-device-token" dataUsingEncoding:NSUTF8StringEncoding];
  ((void (*)(id, SEL, id, NSData *))objc_msgSend)(
      instance, TokenSel(), UIApplication.sharedApplication, token);
}

- (void)invokeResponse:(UNNotificationResponse *)response
                    on:(id)instance
                center:(UNUserNotificationCenter *)center {
  ((void (*)(id, SEL, id, id, void (^)(void)))objc_msgSend)(
      instance, RespSel(), center, response, ^{ gCompletionCalls++; });
}

#pragma mark - 1. real lifecycle: the real app delegate was instrumented at launch

- (void)test_realLifecycle_realAppDelegateInstrumentedAndForwards {
  id appDelegate = UIApplication.sharedApplication.delegate;
  XCTAssertNotNil(appDelegate, @"the real app delegate must be set by UIApplicationMain");
  XCTAssertTrue([appDelegate respondsToSelector:TokenSel()],
                @"Galva added the APNs-token method to the REAL app delegate during launch");

  [self invokeTokenOn:appDelegate];  // drive the real, swizzled delegate method
  XCTAssertEqual(gGalvaTokenForwards, 1u,
                 @"the real Galva shim forwarded the token from the real app delegate");
}

#pragma mark - 2. real lifecycle: real UNUserNotificationCenter setDelegate: swizzle

- (void)test_realLifecycle_lateNotificationDelegateInstrumentedViaRealCenter {
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  XCTAssertNotNil(center, @"app-hosted: the real notification center must exist");
  id priorDelegate = center.delegate;

  Class cls = [self makeDelegateClassWithToken:NO response:YES];
  id late = [cls new];
  center.delegate = late;  // real setDelegate:, swizzled at launch → instruments `late`

  UNNotificationResponse *response = MakeResponse(@{ @"sender": @"galva" },
                                                  UNNotificationDefaultActionIdentifier);
  XCTAssertNotNil(response, @"could not build a UNNotificationResponse for the test");

  [self invokeResponse:response on:late center:center];
  XCTAssertEqual(gGalvaResponseForwards, 1u,
                 @"late-assigned UN delegate was instrumented via the real center's setDelegate: swizzle");
  XCTAssertEqual(gHostResponseCalls, 1u, @"the delegate's own response impl still ran (chained)");
  XCTAssertEqual(gCompletionCalls, 1u, @"completion handler called exactly once");

  center.delegate = priorDelegate;  // restore
}

#pragma mark - 3 & 4. coexistence with a competitor swizzler — both load orders

- (void)test_coexist_token_competitorThenGalva {
  Class cls = [self makeDelegateClassWithToken:YES response:NO];
  [GalvaE2ECompetitorSwizzler swizzleAppDelegateClass:cls];   // competitor first
  id inst = [cls new];
  [GalvaAutoWireInstaller instrumentApplicationDelegate:inst]; // then Galva

  [self invokeTokenOn:inst];
  XCTAssertEqual(gGalvaTokenForwards, 1u, @"Galva forwarded the token once");
  XCTAssertEqual([GalvaE2ECompetitorSwizzler tokenForwardCount], 1u, @"competitor's swizzle ran once");
  XCTAssertEqual(gHostTokenCalls, 1u, @"the host's own implementation still ran once");
}

- (void)test_coexist_token_galvaThenCompetitor {
  Class cls = [self makeDelegateClassWithToken:YES response:NO];
  id inst = [cls new];
  [GalvaAutoWireInstaller instrumentApplicationDelegate:inst]; // Galva first
  [GalvaE2ECompetitorSwizzler swizzleAppDelegateClass:cls];   // then competitor

  [self invokeTokenOn:inst];
  XCTAssertEqual(gGalvaTokenForwards, 1u, @"Galva forwarded the token once");
  XCTAssertEqual([GalvaE2ECompetitorSwizzler tokenForwardCount], 1u, @"competitor's swizzle ran once");
  XCTAssertEqual(gHostTokenCalls, 1u, @"the host's own implementation still ran once");
}

#pragma mark - 5. coexistence on the UN response: completion handler EXACTLY once

- (void)test_coexist_notificationResponse_completionExactlyOnce {
  Class cls = [self makeDelegateClassWithToken:NO response:YES];
  [GalvaE2ECompetitorSwizzler swizzleUNDelegateClass:cls];     // competitor first
  id inst = [cls new];
  [GalvaAutoWireInstaller instrumentNotificationDelegate:inst]; // then Galva

  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  UNNotificationResponse *response = MakeResponse(@{ @"sender": @"galva", @"id": @"abc" },
                                                  UNNotificationDefaultActionIdentifier);
  XCTAssertNotNil(response, @"could not build a UNNotificationResponse for the test");

  [self invokeResponse:response on:inst center:center];
  XCTAssertEqual(gGalvaResponseForwards, 1u, @"Galva forwarded the response once");
  XCTAssertEqual([GalvaE2ECompetitorSwizzler responseForwardCount], 1u, @"competitor's swizzle ran once");
  XCTAssertEqual(gHostResponseCalls, 1u, @"the host's own response impl ran once");
  XCTAssertEqual(gCompletionCalls, 1u,
                 @"completion handler called EXACTLY once across host + Galva + competitor");
}

@end
