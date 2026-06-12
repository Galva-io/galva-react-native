# Push notifications with Galva

Galva delivers retention messages over push. The SDK does **not** request
permission or fetch tokens itself — your app owns its push stack; Galva only
needs to be told the token. Two calls are involved:

| Call | What it does |
|---|---|
| `setDeviceToken(token)` | Attaches the device token to the device record (outgoing message routing). Call it whenever the OS hands you a token. |
| `registerPushToken(token, platform?)` | Registers the token as a **communication endpoint** (an address Galva may push to). `platform`: `'apns'` (default) or `'fcm'`. |
| `unregisterPushToken(token, platform?)` | Removes the endpoint (e.g. on logout or push opt-out). |
| `setCommunicationPreference({ channel: 'pushNotification', … })` | User-level channel preference (disable entirely or per category). |

> **Platform status:** fully backed on iOS. On Android the SDK is a stub until
> the Galva Android core ships `1.0.0` ([plan §3.6](../galva-rn-sdk-plan.md)) —
> calls no-op with a one-time warning, so it is safe to wire FCM now.

## 1. Bare React Native — iOS (APNs)

Request permission and register with your preferred library (or manually).
When iOS delivers the token, hex-encode it and hand it to Galva:

```swift
// AppDelegate.swift
func application(
  _ application: UIApplication,
  didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
) {
  let hexToken = deviceToken.map { String(format: "%02x", $0) }.joined()
  // Hand off to JS however you prefer (event, initial props, …) and call:
  //   setDeviceToken(hexToken)
  //   registerPushToken(hexToken)            // 'apns' is the default
}
```

If you use a JS push library that surfaces the token directly (e.g.
`@react-native-firebase/messaging` with APNs, or `react-native-push-notification`),
just forward what it gives you:

```ts
import { setDeviceToken, registerPushToken } from '@galva/react-native';

const token = await messaging().getAPNSToken(); // hex string
if (token) {
  setDeviceToken(token);
  registerPushToken(token); // platform 'apns' implied
}
```

The app also needs the standard project config — `aps-environment`
entitlement and (for background delivery) `UIBackgroundModes:
[remote-notification]`. On Expo the Galva config plugin injects both
(see [expo.md](expo.md)); on bare RN set them in Xcode once.

## 2. Bare React Native — Android (FCM)

Fetch the FCM registration token with your Firebase library and register it
with `platform: 'fcm'`:

```ts
import messaging from '@react-native-firebase/messaging';
import { setDeviceToken, registerPushToken } from '@galva/react-native';

const token = await messaging().getToken();
setDeviceToken(token);
registerPushToken(token, 'fcm');

messaging().onTokenRefresh((next) => {
  setDeviceToken(next);
  registerPushToken(next, 'fcm');
});
```

Android 13+ requires the `POST_NOTIFICATIONS` runtime permission — declare it
in the manifest (the Expo plugin does this; on bare RN add it yourself) and
request it at runtime via your permission library.

## 3. Expo

Same JS calls; get the token from `expo-notifications`:

```ts
import * as Notifications from 'expo-notifications';
import { setDeviceToken, registerPushToken } from '@galva/react-native';
import { Platform } from 'react-native';

const { data: token } = await Notifications.getDevicePushTokenAsync();
setDeviceToken(token);
registerPushToken(token, Platform.OS === 'android' ? 'fcm' : 'apns');
```

Add the config plugin so prebuild injects the native project config
(entitlement + background mode on iOS, `POST_NOTIFICATIONS` on Android):

```jsonc
// app.json
{ "expo": { "plugins": ["@galva/react-native"] } }
// or, if the app doesn't use Galva's push channel:
{ "expo": { "plugins": [["@galva/react-native", { "push": false }]] } }
```

## 4. Unregistering & preferences

```ts
import {
  unregisterPushToken,
  setCommunicationPreference,
} from '@galva/react-native';

// On logout / token invalidation:
unregisterPushToken(currentToken); // + 'fcm' on Android

// User-level mute of the push channel (server-side preference):
setCommunicationPreference({ channel: 'pushNotification', disabled: true });
```
