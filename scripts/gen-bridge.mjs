#!/usr/bin/env node
//
// gen-bridge.mjs
//
// Generates ios/bridge/GalvaModule.m from the `GalvaNativeModule` interface in
// src/native/GalvaNative.ts (parsed with the TypeScript compiler API). The TS
// interface is the single source of truth for the JS<->native contract:
//
//   • `npm run gen:bridge`   — (re)write GalvaModule.m from the interface.
//   • `npm run check:bridge` — fail if the committed .m is stale AND verify
//                              GalvaModule.swift exposes a matching @objc(...)
//                              selector for every method.
//
// This makes JS<->Obj-C drift structurally impossible (the .m is derived, not
// hand-kept) and statically checks the Obj-C<->Swift selector match. The
// remaining axis — that each Swift selector is actually *reachable* at runtime —
// is covered by the example app's E2E contract smoke. We chose this over
// codegen to keep the legacy bridge's wide RN-version portability.
//
// Selector convention (must match the hand-written Swift @objc selectors):
//   • first declared param  -> the method-name segment   (`name:`)
//   • each later param `p`   -> `with<Pascal(p)>:`
//   • Promise return         -> append `withResolver:`(resolve, only if there
//                               was a declared param) + `withRejecter:`(reject);
//                               a 0-param Promise puts resolve in the name segment.
//

import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TS_PATH = join(root, 'src/native/GalvaNative.ts');
const M_PATH = join(root, 'ios/bridge/GalvaModule.m');
const SWIFT_PATH = join(root, 'ios/bridge/GalvaModule.swift');
const INTERFACE = 'GalvaNativeModule';
// Provided natively by RCTEventEmitter — not externed, not in the Swift impl.
const EMITTER_BUILTINS = new Set(['addListener', 'removeListeners']);

const pascal = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Map a TS parameter type to an Obj-C bridge type. */
function objcType(typeText) {
  const nullable = /\b(null|undefined)\b/.test(typeText);
  const base = typeText.replace(/\s*\|\s*(null|undefined)\s*/g, '').trim();
  let t;
  if (base === 'string') t = 'NSString *';
  else if (base === 'boolean') t = 'BOOL';
  else if (base === 'number') t = 'NSNumber *';
  else t = 'NSDictionary *'; // config / notification payload / Record<...>
  if (nullable && t !== 'BOOL') t = 'nullable ' + t;
  return t;
}

function parseMethods() {
  const src = readFileSync(TS_PATH, 'utf8');
  const sf = ts.createSourceFile(TS_PATH, src, ts.ScriptTarget.Latest, true);
  const methods = [];
  const visit = (node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === INTERFACE) {
      for (const m of node.members) {
        if (!ts.isMethodSignature(m) || !m.name) continue;
        const name = m.name.getText(sf);
        if (EMITTER_BUILTINS.has(name)) continue;
        const params = m.parameters.map((p) => ({
          name: p.name.getText(sf),
          type: p.type ? p.type.getText(sf) : 'unknown',
        }));
        const ret = m.type ? m.type.getText(sf) : 'void';
        methods.push({ name, params, isPromise: ret.startsWith('Promise') });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (methods.length === 0) throw new Error(`No methods found in interface ${INTERFACE}`);
  return methods;
}

/** Build the RCT_EXTERN_METHOD body + the bare selector for one method. */
function buildExtern({ name, params, isPromise }) {
  if (params.length === 0 && !isPromise) {
    return { extern: name, selector: name };
  }
  const segs = [];
  const selector = [];
  if (params.length >= 1) {
    segs.push(`${name}:(${objcType(params[0].type)})${params[0].name}`);
  } else {
    segs.push(`${name}:(RCTPromiseResolveBlock)resolve`);
  }
  selector.push(`${name}:`);
  for (let i = 1; i < params.length; i++) {
    const label = `with${pascal(params[i].name)}`;
    segs.push(`${label}:(${objcType(params[i].type)})${params[i].name}`);
    selector.push(`${label}:`);
  }
  if (isPromise) {
    if (params.length >= 1) {
      segs.push('withResolver:(RCTPromiseResolveBlock)resolve');
      selector.push('withResolver:');
    }
    segs.push('withRejecter:(RCTPromiseRejectBlock)reject');
    selector.push('withRejecter:');
  }
  return { extern: segs.join(' '), selector: selector.join('') };
}

function render(methods) {
  const externs = methods
    .map((m) => `RCT_EXTERN_METHOD(${buildExtern(m).extern})`)
    .join('\n\n');
  return `//
//  GalvaModule.m
//  @galva/react-native
//
//  AUTO-GENERATED from src/native/GalvaNative.ts by scripts/gen-bridge.mjs.
//  Do NOT edit by hand — run "npm run gen:bridge". "npm run check:bridge" fails
//  if this file is stale and verifies GalvaModule.swift exposes a matching
//  @objc(...) selector for every method. The example app's E2E smoke exercises
//  them against the real native module.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_REMAP_MODULE(Galva, GalvaModule, RCTEventEmitter)

${externs}

@end
`;
}

const methods = parseMethods();
const content = render(methods);

if (process.argv.includes('--check')) {
  let ok = true;

  const existing = readFileSync(M_PATH, 'utf8');
  if (existing !== content) {
    ok = false;
    console.error('✗ ios/bridge/GalvaModule.m is out of date — run "npm run gen:bridge".');
  }

  const swift = readFileSync(SWIFT_PATH, 'utf8');
  const swiftSelectors = new Set(
    [...swift.matchAll(/@objc\(([^)]+)\)\s*func\b/g)].map((m) => m[1])
  );
  for (const m of methods) {
    const { selector } = buildExtern(m);
    if (!swiftSelectors.has(selector)) {
      ok = false;
      console.error(`✗ GalvaModule.swift is missing @objc(${selector}) for "${m.name}".`);
    }
  }

  if (!ok) process.exit(1);
  console.log(
    `✓ Bridge in sync — ${methods.length} methods: GalvaModule.m matches GalvaNative.ts and every Swift @objc selector is present.`
  );
} else {
  writeFileSync(M_PATH, content);
  console.log(`Generated ios/bridge/GalvaModule.m from GalvaNative.ts (${methods.length} methods).`);
}
