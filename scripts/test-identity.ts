#!/usr/bin/env bun
//
// test-identity.ts  (npm run test:identity)
//
// Pins the SDK identity the React Native SDK reports to the Galva backend:
// `react-native-<platform>/<version>` (e.g. `react-native-ios/0.1.0`). The core
// sends this as the `x-sdk-version` header + library context, so a drift here
// would make RN installs indistinguishable from the native cores they wrap —
// the exact "untraceable" problem this identity exists to solve.
//
// RN-free (pure helper + generated VERSION), so bun runs it without a React
// Native runtime. The native side (decode → Galva.configure(wrapper:) → header)
// is covered by galva-ios SDKIdentityTests/UploaderTests + the example build.
//

import assert from 'node:assert/strict';
import { wrapperIdentity } from '../src/internal/sdkIdentity';
import { VERSION } from '../src/version';

let passed = 0;
function test(name: string, fn: () => void): void {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log('wrapperIdentity (react-native-<platform>/<version>)');

test('iOS → react-native-ios/<version>', () => {
  const id = wrapperIdentity('ios', VERSION);
  assert.equal(id.name, 'react-native-ios');
  assert.equal(id.version, VERSION);
  assert.equal(`${id.name}/${id.version}`, `react-native-ios/${VERSION}`);
});

test('Android → react-native-android/<version>', () => {
  const id = wrapperIdentity('android', VERSION);
  assert.equal(id.name, 'react-native-android');
  assert.equal(`${id.name}/${id.version}`, `react-native-android/${VERSION}`);
});

test('name always carries the react-native- prefix (any platform)', () => {
  for (const os of ['ios', 'android', 'macos', 'windows', 'web']) {
    assert.ok(
      wrapperIdentity(os, VERSION).name.startsWith('react-native-'),
      `expected react-native- prefix for ${os}`
    );
  }
});

test('version is the package version (non-empty semver-ish)', () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+/);
});

console.log(`\n✓ all ${passed} identity tests passed`);
