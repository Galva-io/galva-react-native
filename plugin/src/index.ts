//
// Expo config plugin for @galva/react-native.
//
// Loaded only by Expo's config system when a managed app lists
// "@galva/react-native" in app.json "plugins". Bare React Native never reads
// this. It injects the native project config Galva needs so managed apps make
// zero native edits.
//

import {
  AndroidConfig,
  createRunOncePlugin,
  withEntitlementsPlist,
  withGradleProperties,
  withInfoPlist,
  withPodfileProperties,
  type ConfigPlugin,
} from '@expo/config-plugins';

// Resolved at runtime in the consumer's Expo env (plugin/build/ -> ../../).
const pkg = require('../../package.json') as { name: string; version: string };

export type GalvaPluginProps = {
  /**
   * Inject push-notification project config: `aps-environment` entitlement +
   * `UIBackgroundModes: [remote-notification]` on iOS, and the
   * `POST_NOTIFICATIONS` runtime permission (Android 13+). Default `true`.
   */
  push?: boolean;
  /**
   * iOS auto-wiring (method swizzling) for the APNs token + notification
   * tap/dismiss. Default `true`. Set `false` to opt out — then forward manually
   * via `registerAPNsToken` / `handleNotificationResponse`.
   */
  swizzle?: boolean;
};

// Galva's native floors. Both raise an existing lower pin only — never lower a
// higher template default (e.g. SDK 54's iOS 15.1), which would break pods built
// against that default.
const IOS_DEPLOYMENT_TARGET = 15.0;
const ANDROID_MIN_SDK = 24;

const withGalvaIos: ConfigPlugin<GalvaPluginProps> = (config, props) => {
  config = withPodfileProperties(config, (c) => {
    const key = 'ios.deploymentTarget';
    const current = c.modResults[key];
    if (current !== undefined && parseFloat(current) < IOS_DEPLOYMENT_TARGET) {
      c.modResults[key] = IOS_DEPLOYMENT_TARGET.toFixed(1);
    }
    return c;
  });

  // Swizzling opt-out flag, read by GalvaAutoWire at launch. Only written when
  // disabling — absent means enabled (the default).
  if (props.swizzle === false) {
    config = withInfoPlist(config, (c) => {
      c.modResults.GalvaSwizzlingEnabled = false;
      return c;
    });
  }

  if (props.push !== false) {
    config = withEntitlementsPlist(config, (c) => {
      // Xcode flips this to "development" automatically for debug signing.
      c.modResults['aps-environment'] =
        c.modResults['aps-environment'] ?? 'production';
      return c;
    });
    config = withInfoPlist(config, (c) => {
      const modes = new Set<string>(
        (c.modResults.UIBackgroundModes as string[] | undefined) ?? []
      );
      modes.add('remote-notification');
      c.modResults.UIBackgroundModes = [...modes];
      return c;
    });
  }

  return config;
};

const withGalvaAndroid: ConfigPlugin<GalvaPluginProps> = (config, props) => {
  config = withGradleProperties(config, (c) => {
    const key = 'android.minSdkVersion';
    const existing = c.modResults.find(
      (item) => item.type === 'property' && item.key === key
    );
    if (
      existing &&
      existing.type === 'property' &&
      parseInt(existing.value, 10) < ANDROID_MIN_SDK
    ) {
      existing.value = String(ANDROID_MIN_SDK);
    }
    return c;
  });

  if (props.push !== false) {
    config = AndroidConfig.Permissions.withPermissions(config, [
      'android.permission.POST_NOTIFICATIONS',
    ]);
  }

  return config;
};

const withGalva: ConfigPlugin<GalvaPluginProps | void> = (config, props) => {
  const resolved: GalvaPluginProps = props ?? {};
  config = withGalvaIos(config, resolved);
  config = withGalvaAndroid(config, resolved);
  return config;
};

export default createRunOncePlugin(withGalva, pkg.name, pkg.version);
