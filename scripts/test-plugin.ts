#!/usr/bin/env bun
//
// test-plugin.ts  (run with bun: `npm run test:plugin`)
//
// Unit tests for the Expo config plugin's deep-link scheme registration. The
// plugin's mods can only run inside a real `expo prebuild`, so we test the pure
// helpers it delegates to. Two things make this hard to break:
//
//   • it imports the plugin's REAL exports (TypeScript source), so it stops
//     compiling if the plugin's API drifts; and
//   • it verifies results through Expo's OWN readers (`getSchemesFromPlist` /
//     `getSchemesFromManifest`) and types (`InfoPlist`, `AndroidManifest`),
//     never our own assumptions about the plist/manifest shape.
//

import assert from 'node:assert/strict';
import { IOSConfig, AndroidConfig } from '@expo/config-plugins';
import GalvaPlugin, {
  normalizeDeepLinkSchemes,
  registerSchemesInInfoPlist,
  registerSchemesInAndroidManifest,
} from '../plugin/src/index';

let passed = 0;
function test(name: string, fn: () => void): void {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

// A minimal, fully-typed AndroidManifest with a `singleTask` launcher activity —
// what Expo's AndroidConfig.Scheme.appendScheme requires to attach a scheme.
function makeManifest(): AndroidConfig.Manifest.AndroidManifest {
  return {
    manifest: {
      $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
      queries: [],
      application: [
        {
          $: { 'android:name': '.MainApplication' },
          activity: [
            {
              $: {
                'android:name': '.MainActivity',
                'android:launchMode': 'singleTask',
              },
              'intent-filter': [
                {
                  action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
                  category: [
                    { $: { 'android:name': 'android.intent.category.LAUNCHER' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

console.log('normalizeDeepLinkSchemes');

test('undefined/empty → []', () => {
  assert.deepEqual(normalizeDeepLinkSchemes(undefined), []);
  assert.deepEqual(normalizeDeepLinkSchemes(''), []);
  assert.deepEqual(normalizeDeepLinkSchemes(['', '   ']), []);
});

test('single string → [scheme]', () => {
  assert.deepEqual(normalizeDeepLinkSchemes('gvAbc123'), ['gvAbc123']);
});

test('strips ://… and trailing :, trims whitespace', () => {
  assert.deepEqual(normalizeDeepLinkSchemes('  gvAbc://open?x=1  '), ['gvAbc']);
  assert.deepEqual(normalizeDeepLinkSchemes('gvAbc:'), ['gvAbc']);
});

test('de-dupes case-insensitively, first spelling wins', () => {
  assert.deepEqual(normalizeDeepLinkSchemes(['gvA', 'GVA', 'gvB']), ['gvA', 'gvB']);
});

console.log('registerSchemesInInfoPlist (verified via Expo IOSConfig.Scheme)');

test('adds a scheme', () => {
  const plist = registerSchemesInInfoPlist({}, ['gvAbc123']);
  assert.deepEqual(IOSConfig.Scheme.getSchemesFromPlist(plist), ['gvAbc123']);
});

test('idempotent — re-running does not duplicate', () => {
  let plist = registerSchemesInInfoPlist({}, ['gvAbc']);
  plist = registerSchemesInInfoPlist(plist, ['gvAbc']);
  assert.deepEqual(IOSConfig.Scheme.getSchemesFromPlist(plist), ['gvAbc']);
});

test("preserves the app's own schemes", () => {
  const start: IOSConfig.InfoPlist = {
    CFBundleURLTypes: [{ CFBundleURLSchemes: ['myapp'] }],
  };
  const plist = registerSchemesInInfoPlist(start, ['gvAbc']);
  const schemes = IOSConfig.Scheme.getSchemesFromPlist(plist);
  assert.ok(schemes.includes('myapp') && schemes.includes('gvAbc'));
});

test('skips a scheme already declared in the plist', () => {
  const start: IOSConfig.InfoPlist = {
    CFBundleURLTypes: [{ CFBundleURLSchemes: ['gvAbc'] }],
  };
  const plist = registerSchemesInInfoPlist(start, ['gvAbc']);
  assert.deepEqual(IOSConfig.Scheme.getSchemesFromPlist(plist), ['gvAbc']);
});

console.log('registerSchemesInAndroidManifest (verified via Expo AndroidConfig.Scheme)');

test('adds a scheme to the launcher activity', () => {
  const manifest = registerSchemesInAndroidManifest(makeManifest(), ['gvAbc123']);
  assert.deepEqual(
    AndroidConfig.Scheme.getSchemesFromManifest(manifest),
    ['gvAbc123']
  );
});

test('idempotent — re-running does not duplicate', () => {
  let manifest = registerSchemesInAndroidManifest(makeManifest(), ['gvAbc']);
  manifest = registerSchemesInAndroidManifest(manifest, ['gvAbc']);
  assert.deepEqual(AndroidConfig.Scheme.getSchemesFromManifest(manifest), ['gvAbc']);
});

test('registers multiple schemes', () => {
  const manifest = registerSchemesInAndroidManifest(makeManifest(), ['gvA', 'gvB']);
  const schemes = AndroidConfig.Scheme.getSchemesFromManifest(manifest);
  assert.ok(schemes.includes('gvA') && schemes.includes('gvB'));
});

console.log('plugin composition');

test('default export composes all mods without throwing', () => {
  const out = GalvaPlugin(
    {
      name: 'GalvaExample',
      slug: 'galva-example',
      ios: { bundleIdentifier: 'com.example.app' },
      android: { package: 'com.example.app' },
    },
    { deepLinkScheme: 'gvabc123', swizzle: false }
  );
  assert.ok(out && typeof out === 'object', 'returns a config object');
});

console.log(`\n✓ all ${passed} plugin tests passed`);
