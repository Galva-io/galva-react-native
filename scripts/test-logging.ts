#!/usr/bin/env bun
//
// test-logging.ts  (npm run test:logging)
//
// Unit tests for the pure log formatting/routing helpers
// (src/internal/logFormat). RN-free, so bun runs them with no React Native
// runtime. The native↔JS wiring (event subscription, setLogForwarding) is
// exercised by the iOS build + example contract smoke.
//

import assert from 'node:assert/strict';
import { consoleCall, dispatchEntry, formatHeader } from '../src/internal/logFormat';
import type { GalvaLogEntry, GalvaLogLevel } from '../src/types';

let passed = 0;
function test(name: string, fn: () => void): void {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

function entry(overrides: Partial<GalvaLogEntry> = {}): GalvaLogEntry {
  return { level: 'info', category: 'queue', message: 'hello', timestamp: 0, ...overrides };
}

console.log('consoleCall (level → console method)');

const mapping: Array<[GalvaLogLevel, string | null]> = [
  ['debug', 'debug'],
  ['info', 'info'],
  ['notice', 'info'],
  ['warning', 'warn'],
  ['error', 'error'],
  ['fault', 'error'],
  ['off', null],
];
for (const [level, method] of mapping) {
  test(`${level} → ${method ?? 'none'}`, () => {
    assert.equal(consoleCall(entry({ level })).method, method);
  });
}

test('header carries colored level label + dimmed category; message separate', () => {
  const { args } = consoleCall(
    entry({ level: 'warning', category: 'uploader', message: 'sent' })
  );
  const header = args[0] as string;
  assert.match(header, /WARN/); // standard-JS-style level prefix
  assert.match(header, /\[galva:uploader\]/);
  assert.ok(header.includes('\x1b[33m'), 'warning is yellow');
  assert.equal(args[1], 'sent');
});

test('metadata appended only when non-empty', () => {
  assert.equal(consoleCall(entry()).args.length, 2);
  assert.equal(consoleCall(entry({ metadata: {} })).args.length, 2);
  assert.deepEqual(consoleCall(entry({ metadata: { status: '503' } })).args[2], {
    status: '503',
  });
});

test('error appended when present', () => {
  const { args } = consoleCall(entry({ error: 'boom' }));
  assert.equal(args[args.length - 1], 'boom');
});

console.log('formatHeader (level prefix + ANSI color)');

const headers: Array<[GalvaLogLevel, string, string]> = [
  ['debug', 'DEBUG', '\x1b[90m'],
  ['info', 'INFO', '\x1b[36m'],
  ['notice', 'NOTICE', '\x1b[34m'],
  ['warning', 'WARN', '\x1b[33m'],
  ['error', 'ERROR', '\x1b[31m'],
  ['fault', 'FAULT', '\x1b[91m'],
];
for (const [level, label, color] of headers) {
  test(`${level} → "${label}" prefix + color`, () => {
    const header = formatHeader(level, 'queue');
    assert.match(header, new RegExp(label));
    assert.ok(header.includes(color), `${level} uses its color`);
    assert.ok(header.includes('[galva:queue]'));
    assert.ok(header.includes('\x1b[0m'), 'resets styling');
  });
}

console.log('dispatchEntry (routing)');

test('custom logger receives the entry; console not used', () => {
  let got: GalvaLogEntry | undefined;
  let consoleUsed = false;
  dispatchEntry(
    entry({ message: 'x' }),
    (e) => {
      got = e;
    },
    () => {
      consoleUsed = true;
    }
  );
  assert.equal(got?.message, 'x');
  assert.equal(consoleUsed, false);
});

test('throwing custom logger does not propagate or fall through to console', () => {
  let consoleUsed = false;
  assert.doesNotThrow(() =>
    dispatchEntry(
      entry(),
      () => {
        throw new Error('nope');
      },
      () => {
        consoleUsed = true;
      }
    )
  );
  assert.equal(consoleUsed, false);
});

test('no custom logger → console sink is used', () => {
  let got: GalvaLogEntry | undefined;
  dispatchEntry(entry({ message: 'y' }), null, (e) => {
    got = e;
  });
  assert.equal(got?.message, 'y');
});

console.log(`\n✓ all ${passed} logging tests passed`);
