#!/usr/bin/env node
//
// check-bridge-parity.mjs
//
// The JS<->native bridge contract lives in three hand-kept places:
//   • ios/bridge/GalvaModule.m       — RCT_EXTERN_METHOD externs (JS-visible names)
//   • ios/bridge/GalvaModule.swift   — @objc(...) method selectors (the impl)
//   • src/native/GalvaNative.ts      — the typed interface src/api/* calls through
//
// We chose the legacy bridge over codegen to keep wide RN-version portability,
// so this guard replaces codegen's compile-time check: every method must appear
// in all three. A rename/removal/addition on one side fails CI. Run in CI and
// before publish.
//

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

// Provided natively by RCTEventEmitter (not declared in our .m); ignore on the
// TS side so they don't look like drift.
const EMITTER_BUILTINS = new Set(['addListener', 'removeListeners']);

/** JS-visible names from the Obj-C externs (first selector segment). */
function objcMethods(src) {
  const set = new Set();
  for (const m of src.matchAll(/RCT_EXTERN_METHOD\(\s*([A-Za-z_]\w*)/g)) set.add(m[1]);
  return set;
}

/** Method names from Swift `@objc(selector)` annotations that precede a `func`
 *  (so the class annotation `@objc(GalvaModule)` is excluded). */
function swiftMethods(src) {
  const set = new Set();
  for (const m of src.matchAll(/@objc\(([^)]+)\)\s*func\b/g)) {
    set.add(m[1].split(':')[0]);
  }
  return set;
}

/** Method names declared in the `GalvaNativeModule` interface body. */
function tsMethods(src) {
  const start = src.indexOf('interface GalvaNativeModule');
  if (start < 0) throw new Error('GalvaNativeModule interface not found in GalvaNative.ts');
  const open = src.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = src.slice(open + 1, end);
  const set = new Set();
  for (const m of body.matchAll(/^\s*([A-Za-z_]\w*)\s*\(/gm)) {
    if (!EMITTER_BUILTINS.has(m[1])) set.add(m[1]);
  }
  return set;
}

const objc = objcMethods(read('ios/bridge/GalvaModule.m'));
const swift = swiftMethods(read('ios/bridge/GalvaModule.swift'));
const ts = tsMethods(read('src/native/GalvaNative.ts'));

const all = [...new Set([...objc, ...swift, ...ts])].sort();
let ok = true;
const rows = all.map((name) => {
  const a = objc.has(name);
  const s = swift.has(name);
  const t = ts.has(name);
  const good = a && s && t;
  if (!good) ok = false;
  return `${good ? '✓' : '✗'}  ${name.padEnd(28)} m:${a ? 'y' : '-'} swift:${s ? 'y' : '-'} ts:${t ? 'y' : '-'}`;
});

console.log(`Bridge parity — ${objc.size} extern / ${swift.size} swift / ${ts.size} ts methods\n`);
console.log(rows.join('\n'));

if (!ok) {
  console.error(
    '\n✗ Bridge contract drift: every method must exist in GalvaModule.m, GalvaModule.swift, and GalvaNative.ts.'
  );
  process.exit(1);
}
console.log('\n✓ Bridge contract is in sync across .m / .swift / .ts');
