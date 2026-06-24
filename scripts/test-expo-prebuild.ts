#!/usr/bin/env bun
//
// test-expo-prebuild.ts  (run with bun: `npm run test:expo:prebuild`)
//
// L1 of the Expo E2E: prove the config plugin works in a REAL `expo prebuild`,
// not just unit tests on its transforms. It packs the SDK, installs it into the
// committed Expo fixture (e2e/expo) exactly as a consumer would, runs
// `expo prebuild`, and asserts the GENERATED native config — read back through
// Expo's own readers (`IOSConfig.Scheme` / `AndroidConfig.Manifest`):
//
//   • the Galva `gv…` deep-link scheme is registered on iOS + Android, and the
//     app's own scheme is preserved (coexistence, not clobbered);
//   • NO push config is injected (we removed that) — no aps-environment, no
//     remote-notification background mode, no POST_NOTIFICATIONS permission.
//
// Deterministic and device-free (`--no-install` skips pods), so it runs on every
// PR. Runtime behavior (deep links actually routing) is L2 (test-expo-runtime.sh).
//

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import plist from '@expo/plist';
import { AndroidConfig, IOSConfig } from '@expo/config-plugins';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = join(ROOT, 'e2e/expo');
const GALVA_SCHEME = 'gvexpoe2e';
const APP_SCHEME = 'galvaexpoe2e';

function run(cmd: string, cwd: string): void {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
  });
}

let failures = 0;
function check(label: string, ok: boolean): void {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures++;
}

// 1. Build + pack the SDK (npm pack runs `prepare`), drop it where the fixture's
//    package.json expects it ("@galva/react-native": "file:./galva.tgz").
console.log('== pack @galva/react-native ==');
run('npm pack --silent', ROOT);
const tarball = readdirSync(ROOT).find((f) => /^galva-react-native-.*\.tgz$/.test(f));
if (!tarball) throw new Error('npm pack produced no tarball');
copyFileSync(join(ROOT, tarball), join(FIXTURE, 'galva.tgz'));
rmSync(join(ROOT, tarball));

// 2. Install the fixture (expo + RN + the packed SDK) and prebuild it.
console.log('== install + prebuild the Expo fixture ==');
run('npm install --no-audit --no-fund', FIXTURE);
run('npx expo prebuild --clean --no-install', FIXTURE);

// 3. Assert the generated native config via Expo's own readers.
console.log('\n== assertions ==');

// iOS — Info.plist URL schemes
const iosDir = join(FIXTURE, 'ios');
const appDir = readdirSync(iosDir).find((d) => existsSync(join(iosDir, d, 'Info.plist')));
if (!appDir) throw new Error('could not locate ios/<app>/Info.plist after prebuild');
const infoPlist = plist.parse(
  readFileSync(join(iosDir, appDir, 'Info.plist'), 'utf8')
) as IOSConfig.InfoPlist;
const iosSchemes = IOSConfig.Scheme.getSchemesFromPlist(infoPlist);
check(`iOS: Galva scheme "${GALVA_SCHEME}" registered`, iosSchemes.includes(GALVA_SCHEME));
check(`iOS: app scheme "${APP_SCHEME}" preserved (coexistence)`, iosSchemes.includes(APP_SCHEME));

const backgroundModes = infoPlist.UIBackgroundModes;
check(
  'iOS: no remote-notification background mode (push not injected)',
  !(Array.isArray(backgroundModes) && backgroundModes.includes('remote-notification'))
);

// iOS — entitlements must not carry aps-environment
const entPath = join(iosDir, appDir, `${appDir}.entitlements`);
const entitlements = existsSync(entPath)
  ? (plist.parse(readFileSync(entPath, 'utf8')) as Record<string, unknown>)
  : {};
check('iOS: no aps-environment entitlement (push not injected)', !('aps-environment' in entitlements));

// Android — manifest intent-filter schemes
const manifestPath = join(FIXTURE, 'android/app/src/main/AndroidManifest.xml');
const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
const androidSchemes = AndroidConfig.Scheme.getSchemesFromManifest(manifest);
check(`Android: Galva scheme "${GALVA_SCHEME}" registered`, androidSchemes.includes(GALVA_SCHEME));
check(`Android: app scheme "${APP_SCHEME}" preserved (coexistence)`, androidSchemes.includes(APP_SCHEME));
check(
  'Android: no POST_NOTIFICATIONS permission (push not injected)',
  !readFileSync(manifestPath, 'utf8').includes('POST_NOTIFICATIONS')
);

if (failures > 0) {
  console.error(`\n✗ ${failures} Expo prebuild assertion(s) failed`);
  process.exit(1);
}
console.log('\n✓ Expo prebuild config assertions passed');
