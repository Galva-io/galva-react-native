import {
  AndroidConfig,
  createRunOncePlugin,
  withEntitlementsPlist,
  withGradleProperties,
  withInfoPlist,
  withPodfileProperties,
  type ConfigPlugin,
} from '@expo/config-plugins';

// Resolved at runtime inside the consumer's Expo env (plugin/build/ → ../../).
const pkg = require('../../package.json') as { name: string; version: string };

export type GalvaPluginProps = {
  /**
   * Inject push-notification project config: the `aps-environment`
   * entitlement + `UIBackgroundModes: [remote-notification]` on iOS, and the
   * `POST_NOTIFICATIONS` permission (Android 13+) on Android. Set `false` if
   * the app does not use Galva's push channel. Default `true`.
   */
  push?: boolean;
};

/** Galva's native floors (plan §3.3/§3.7). Never lowers an existing value. */
const IOS_DEPLOYMENT_TARGET = 15.0;
const ANDROID_MIN_SDK = 24;

const withGalvaIos: ConfigPlugin<GalvaPluginProps> = (config, props) => {
  config = withPodfileProperties(config, (c) => {
    const key = 'ios.deploymentTarget';
    const current = parseFloat(c.modResults[key] ?? '0');
    // Raise only when the project pins something lower; when the property is
    // absent on a modern SDK the template default (≥ 15.1) already satisfies
    // the floor — except old SDKs, where absent means < 15 → set it.
    if (current < IOS_DEPLOYMENT_TARGET) {
      c.modResults[key] = IOS_DEPLOYMENT_TARGET.toFixed(1);
    }
    return c;
  });

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
    // Same raise-only stance as iOS: absent on a modern SDK already means
    // minSdk ≥ 24 via the template default; only fix an explicit lower pin.
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
    // INTERNET / ACCESS_NETWORK_STATE come from the Galva AAR's own manifest
    // (merged for free) — only the runtime notification permission is needed.
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
