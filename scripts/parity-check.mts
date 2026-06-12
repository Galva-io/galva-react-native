// Parity check (plan §7 Phase 3): mechanically diffs the JS surface against
// every native bridge so the three implementations can't drift apart.
//
// Invariants enforced:
//   1. src/index.ts re-exports exactly one named export per src/api/* file
//      (the sanctioned barrel — plan §5).
//   2. Every method of the GalvaNativeModule interface (src/NativeBridge.ts —
//      the JS↔native join point) is declared in the iOS bridge
//      (RCT_EXTERN_METHOD in GalvaModule.m). addListener/removeListeners are
//      exempt on iOS: RCTEventEmitter's base class provides them.
//   3. The same set is implemented (@ReactMethod) in BOTH Android source sets
//      (src/stub/kotlin and src/core/kotlin) — the two compile exclusively,
//      so nothing else catches drift between them.
//   4. Escape hatch: a method missing on one platform is a tracked TODO (not
//      an error) ONLY if its src/api/<name>.ts doc carries an `@platform`
//      tag (plan §6.2) — missing AND untagged fails the build.
//
// Runs under Node's native TypeScript type-stripping (Node ≥ 22.18 / 24):
//   node scripts/parity-check.ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (p: string): string => readFileSync(join(root, p), 'utf8');

const errors: string[] = [];
const todos: string[] = [];

// RCTEventEmitter/NativeEventEmitter contract — present in the JS interface
// and on Android, provided by the RCTEventEmitter base class on iOS.
const EMITTER_CONTRACT = new Set(['addListener', 'removeListeners']);

const matchAll = (src: string, re: RegExp): Set<string> =>
  new Set([...src.matchAll(re)].map((m) => m[1] as string));

// --- 1. barrel ↔ api/ files ---------------------------------------------------
const apiFiles = readdirSync(join(root, 'src/api'))
  .filter((f) => f.endsWith('.ts'))
  .map((f) => f.replace(/\.ts$/, ''))
  .sort();
const indexSrc = read('src/index.ts');
const indexExports = matchAll(
  indexSrc,
  /export \{ (\w+) \} from '\.\/api\/(\w+)'/g
);
for (const m of indexSrc.matchAll(
  /export \{ (\w+) \} from '\.\/api\/(\w+)'/g
)) {
  if (m[1] !== m[2]) {
    errors.push(
      `index.ts: export '${m[1]}' does not match its file './api/${m[2]}' (one export per file, same name — plan §5)`
    );
  }
}
for (const f of apiFiles) {
  if (!indexExports.has(f)) {
    errors.push(`index.ts: missing re-export for src/api/${f}.ts`);
  }
}
for (const e of indexExports) {
  if (!apiFiles.includes(e)) {
    errors.push(`index.ts: exports '${e}' but src/api/${e}.ts does not exist`);
  }
}

// --- collect the four method sets ---------------------------------------------
const bridgeSrc = read('src/NativeBridge.ts');
const interfaceBlock = bridgeSrc.match(
  /type GalvaNativeModule = \{([\s\S]*?)\n\};/
)?.[1];
if (!interfaceBlock) {
  errors.push('NativeBridge.ts: could not locate `type GalvaNativeModule = {…}`');
}
const jsMethods = interfaceBlock
  ? matchAll(interfaceBlock, /^\s+(\w+)\(/gm)
  : new Set<string>();

const iosM = read('ios/bridge/GalvaModule.m');
if (!/RCT_EXTERN_REMAP_MODULE\(\s*Galva\s*,\s*GalvaModule/.test(iosM)) {
  errors.push(
    'GalvaModule.m: RCT_EXTERN_REMAP_MODULE(Galva, GalvaModule, …) not found — JS module name must stay "Galva"'
  );
}
const iosMethods = matchAll(iosM, /RCT_EXTERN_METHOD\(\s*(\w+)/g);

const androidSets: Record<string, Set<string>> = {};
for (const variant of ['stub', 'core']) {
  androidSets[variant] = matchAll(
    read(`android/src/${variant}/kotlin/com/galva/reactnative/GalvaModule.kt`),
    /@ReactMethod\s+(?:override\s+)?fun\s+(\w+)/g
  );
}

// --- 2..4: compare -------------------------------------------------------------
const isPlatformTagged = (method: string): boolean => {
  try {
    return read(`src/api/${method}.ts`).includes('@platform');
  } catch {
    return false;
  }
};

function compare(label: string, native: Set<string>, iosExempt: boolean) {
  for (const m of jsMethods) {
    if (iosExempt && EMITTER_CONTRACT.has(m)) continue;
    if (!native.has(m)) {
      if (isPlatformTagged(m)) {
        todos.push(`${label}: '${m}' missing — tracked via @platform tag (plan §6.2)`);
      } else {
        errors.push(
          `${label}: JS calls '${m}' but the bridge does not declare it (add it, or tag src/api/${m}.ts with @platform)`
        );
      }
    }
  }
  for (const m of native) {
    if (!jsMethods.has(m)) {
      errors.push(
        `${label}: declares '${m}' which the JS GalvaNativeModule interface never calls (dead surface)`
      );
    }
  }
}

compare('iOS (GalvaModule.m)', iosMethods, true);
compare('Android stub', androidSets.stub!, false);
compare('Android core', androidSets.core!, false);

// --- report --------------------------------------------------------------------
console.log(
  `parity-check: ${apiFiles.length} api exports · ${jsMethods.size} native interface methods · ` +
    `iOS ${iosMethods.size} · Android stub ${androidSets.stub!.size} / core ${androidSets.core!.size}`
);
for (const t of todos) console.log(`  TODO  ${t}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`  ERROR ${e}`);
  console.error(`parity-check: FAILED (${errors.length} error(s))`);
  process.exit(1);
}
console.log('parity-check: OK');
