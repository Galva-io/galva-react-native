//
// Expo config plugin for @galva/react-native.
//
// Loaded only by Expo's config system when a managed app lists
// "@galva/react-native" in app.json "plugins". Bare React Native never reads
// this. It injects the native project config Galva needs so managed apps make
// zero native edits.
//
// Deep-link scheme registration delegates to Expo's own `IOSConfig.Scheme` /
// `AndroidConfig.Scheme` helpers (the same ones that back Expo's `scheme`
// field), so we never hand-roll `CFBundleURLTypes` / `intent-filter` shapes or
// invent plist types — Expo owns that.
//

import {
  AndroidConfig,
  IOSConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withGradleProperties,
  withInfoPlist,
  withPodfileProperties,
  type ConfigPlugin,
} from '@expo/config-plugins';

// Resolved at runtime relative to this file (plugin/build or plugin/src). Kept
// as `require` so the plugin's `rootDir: src` build doesn't pull package.json in.
const pkg = require('../../package.json') as { name: string; version: string };

export type GalvaPluginProps = {
  /**
   * iOS auto-wiring (method swizzling) for the APNs token + notification
   * tap/dismiss. Default `true`. Set `false` to opt out — then forward manually
   * via `registerAPNsToken` / `handleNotificationResponse`.
   *
   * Note: this only wires Galva to *observe* push interactions. Enabling push
   * capability itself (entitlements, `UIBackgroundModes`, the Android
   * `POST_NOTIFICATIONS` permission, requesting authorization, registering for
   * remote notifications) is your app's responsibility — use `expo-notifications`
   * or the platform docs. Galva deliberately doesn't touch that config.
   */
  swizzle?: boolean;
  /**
   * Galva deep-link URL scheme(s) to register so the OS routes Galva links to
   * your app. Copy this from your Galva dashboard — it's the per-app scheme
   * Galva assigns (begins with `gv`, e.g. `"gvabc123"`). The plugin registers
   * it on iOS (`CFBundleURLTypes`) and Android (launcher `intent-filter`) via
   * Expo's scheme helpers; the SDK then claims matching links automatically (no
   * AppDelegate/scene edits). Accepts a single scheme or an array. A bare
   * `scheme` (with or without a trailing `://`) is fine — it's normalized.
   */
  deepLinkScheme?: string | string[];
};

// Internal: the resolved props plus the normalized scheme list, threaded to the
// per-platform mods so normalization (and any warning) happens exactly once.
type ResolvedProps = GalvaPluginProps & { schemes: string[] };

// Galva's native floors. Both raise an existing lower pin only — never lower a
// higher template default (e.g. SDK 54's iOS 15.1), which would break pods built
// against that default.
const IOS_DEPLOYMENT_TARGET = 15.0;
const ANDROID_MIN_SDK = 24;

// ---------------------------------------------------------------------------
// Pure helpers (no Expo mod machinery) — unit-tested directly by
// scripts/test-plugin.ts.
// ---------------------------------------------------------------------------

/**
 * Normalize a `deepLinkScheme` prop into a clean, de-duplicated list of scheme
 * strings: trims whitespace, strips any `://…` (or trailing `:`) so `"gvAbc://"`
 * and `"gvAbc"` collapse, drops empties, and de-dupes case-insensitively
 * (first spelling wins). No validation — whatever remains is registered.
 */
export function normalizeDeepLinkSchemes(
  input: string | string[] | undefined
): string[] {
  if (input == null) return [];
  const raw = Array.isArray(input) ? input : [input];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const scheme = item.trim().replace(/:.*$/, '').trim();
    if (!scheme) continue;
    if (!out.some((s) => s.toLowerCase() === scheme.toLowerCase())) {
      out.push(scheme);
    }
  }
  return out;
}

/**
 * Register `schemes` in `CFBundleURLTypes` via Expo's `IOSConfig.Scheme`. Idem-
 * potent: `appendScheme` already skips a scheme that's present, and `hasScheme`
 * guards re-adds, so the app's own URL types are never touched.
 */
export function registerSchemesInInfoPlist(
  infoPlist: IOSConfig.InfoPlist,
  schemes: string[]
): IOSConfig.InfoPlist {
  return schemes.reduce<IOSConfig.InfoPlist>(
    (plist, scheme) =>
      IOSConfig.Scheme.hasScheme(scheme, plist)
        ? plist
        : IOSConfig.Scheme.appendScheme(scheme, plist),
    infoPlist
  );
}

/**
 * Register `schemes` on the Android launcher activity via Expo's
 * `AndroidConfig.Scheme`. `appendScheme` doesn't de-dupe, so we guard with
 * `hasScheme` to stay idempotent; Expo ensures/creates the redirect
 * intent-filter on the `singleTask` activity.
 */
export function registerSchemesInAndroidManifest(
  androidManifest: AndroidConfig.Manifest.AndroidManifest,
  schemes: string[]
): AndroidConfig.Manifest.AndroidManifest {
  return schemes.reduce<AndroidConfig.Manifest.AndroidManifest>(
    (manifest, scheme) =>
      AndroidConfig.Scheme.hasScheme(scheme, manifest)
        ? manifest
        : AndroidConfig.Scheme.appendScheme(scheme, manifest),
    androidManifest
  );
}

// ---------------------------------------------------------------------------
// Mods
// ---------------------------------------------------------------------------

const withGalvaIos: ConfigPlugin<ResolvedProps> = (config, props) => {
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

  if (props.schemes.length > 0) {
    config = withInfoPlist(config, (c) => {
      c.modResults = registerSchemesInInfoPlist(c.modResults, props.schemes);
      return c;
    });
  }

  return config;
};

const withGalvaAndroid: ConfigPlugin<ResolvedProps> = (config, props) => {
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

  if (props.schemes.length > 0) {
    config = withAndroidManifest(config, (c) => {
      c.modResults = registerSchemesInAndroidManifest(
        c.modResults,
        props.schemes
      );
      return c;
    });
  }

  return config;
};

const withGalva: ConfigPlugin<GalvaPluginProps | void> = (config, props) => {
  const resolved: ResolvedProps = {
    ...(props ?? {}),
    schemes: normalizeDeepLinkSchemes((props ?? {}).deepLinkScheme),
  };
  config = withGalvaIos(config, resolved);
  config = withGalvaAndroid(config, resolved);
  return config;
};

export default createRunOncePlugin(withGalva, pkg.name, pkg.version);
