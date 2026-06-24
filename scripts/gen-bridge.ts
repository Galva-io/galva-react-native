#!/usr/bin/env bun
//
// gen-bridge.ts  (run with bun)
//
// Generates the Swift⇄JS bridge contract from src/native/GalvaNative.ts (parsed
// with the TypeScript compiler API) — the single source of truth:
//
//   • ios/bridge/GalvaModule.m        — RCT_EXTERN_METHOD list (method selectors)
//   • ios/bridge/GalvaBridgeTypes.swift — Decodable structs for the object
//                                         payloads (NativeGalvaConfig,
//                                         NativeNotificationResponse), so Swift
//                                         parses the JS payloads confidently.
//
//   • `npm run gen:bridge`   — (re)write both generated files.
//   • `npm run check:bridge` — fail if either is stale AND verify
//                              GalvaModule.swift exposes a matching @objc(...)
//                              selector for every method.
//
// Drift between TS and native becomes a build/CI error, not a runtime bug: the
// .m is derived (not hand-kept), the Swift selectors are checked, and now the
// payload-parsing structs are derived too (field renames/additions surface as a
// Swift compile error in the bridge mappers). Runtime reachability is covered by
// the example app's E2E contract smoke.
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

interface Param {
  name: string;
  type: string;
}
interface Method {
  name: string;
  params: Param[];
  isPromise: boolean;
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TS_PATH = join(root, 'src/native/GalvaNative.ts');
const M_PATH = join(root, 'ios/bridge/GalvaModule.m');
const SWIFT_PATH = join(root, 'ios/bridge/GalvaModule.swift');
const TYPES_PATH = join(root, 'ios/bridge/GalvaBridgeTypes.swift');
const INTERFACE = 'GalvaNativeModule';
// Object payloads to generate Swift Decodable structs for (the params typed as
// interfaces, not loose Records or scalars).
const TYPE_INTERFACES = ['NativeGalvaConfig', 'NativeNotificationResponse'];
// Provided natively by RCTEventEmitter — not externed, not in the Swift impl.
const EMITTER_BUILTINS = new Set(['addListener', 'removeListeners']);

const pascal = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function sourceFile(): ts.SourceFile {
  return ts.createSourceFile(
    TS_PATH,
    readFileSync(TS_PATH, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
}

// ---------------------------------------------------------------------------
// GalvaModule.m — method selectors
// ---------------------------------------------------------------------------

/** Map a TS parameter type to an Obj-C bridge type. */
function objcType(typeText: string): string {
  const nullable = /\b(null|undefined)\b/.test(typeText);
  const base = typeText.replace(/\s*\|\s*(null|undefined)\s*/g, '').trim();
  let t: string;
  if (base === 'string') t = 'NSString *';
  else if (base === 'boolean') t = 'BOOL';
  else if (base === 'number') t = 'NSNumber *';
  else t = 'NSDictionary *'; // config / notification payload / Record<...>
  if (nullable && t !== 'BOOL') t = 'nullable ' + t;
  return t;
}

function parseMethods(sf: ts.SourceFile): Method[] {
  const methods: Method[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === INTERFACE) {
      for (const m of node.members) {
        if (!ts.isMethodSignature(m) || !m.name) continue;
        const name = m.name.getText(sf);
        if (EMITTER_BUILTINS.has(name)) continue;
        const params: Param[] = m.parameters.map((p) => ({
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
  if (methods.length === 0) {
    throw new Error(`No methods found in interface ${INTERFACE}`);
  }
  return methods;
}

/** Build the RCT_EXTERN_METHOD body + the bare selector for one method. */
function buildExtern({ name, params, isPromise }: Method): {
  extern: string;
  selector: string;
} {
  if (params.length === 0 && !isPromise) {
    return { extern: name, selector: name };
  }
  const segs: string[] = [];
  const selector: string[] = [];
  const [first, ...rest] = params;
  if (first) {
    segs.push(`${name}:(${objcType(first.type)})${first.name}`);
  } else {
    segs.push(`${name}:(RCTPromiseResolveBlock)resolve`);
  }
  selector.push(`${name}:`);
  for (const p of rest) {
    const label = `with${pascal(p.name)}`;
    segs.push(`${label}:(${objcType(p.type)})${p.name}`);
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

function renderModuleM(methods: Method[]): string {
  const externs = methods
    .map((m) => `RCT_EXTERN_METHOD(${buildExtern(m).extern})`)
    .join('\n\n');
  return `//
//  GalvaModule.m
//  @galva/react-native
//
//  AUTO-GENERATED from src/native/GalvaNative.ts by scripts/gen-bridge.ts.
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

// ---------------------------------------------------------------------------
// GalvaBridgeTypes.swift — Decodable structs for the object payloads
// ---------------------------------------------------------------------------

// Swift keywords that must be back-ticked when used as enum case names.
const SWIFT_KEYWORDS = new Set([
  'default', 'class', 'struct', 'enum', 'case', 'import', 'protocol',
  'extension', 'func', 'let', 'var', 'init', 'self', 'static', 'public',
  'private', 'internal', 'return', 'true', 'false', 'nil', 'guard', 'where',
]);

function findInterface(sf: ts.SourceFile, name: string): ts.InterfaceDeclaration {
  let found: ts.InterfaceDeclaration | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === name) found = node;
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!found) throw new Error(`Interface ${name} not found in ${TS_PATH}`);
  return found;
}

/**
 * Map a TS type node to a Swift type. Pushes any generated nested types (structs
 * / enums) into `decls`. Throws on shapes we don't support, so a new payload
 * shape fails generation loudly instead of mis-parsing at runtime.
 */
function mapType(
  node: ts.TypeNode,
  sf: ts.SourceFile,
  typeName: string,
  decls: string[]
): { swift: string; optional: boolean } {
  switch (node.kind) {
    case ts.SyntaxKind.StringKeyword:
      return { swift: 'String', optional: false };
    case ts.SyntaxKind.BooleanKeyword:
      return { swift: 'Bool', optional: false };
    case ts.SyntaxKind.NumberKeyword:
      return { swift: 'Double', optional: false };
  }
  if (ts.isTypeReferenceNode(node) && node.typeName.getText(sf) === 'Record') {
    // Loose JSON map (e.g. Record<string, unknown>) → the core's JSON value.
    return { swift: '[String: AnyJSONValue]', optional: false };
  }
  if (ts.isTypeLiteralNode(node)) {
    decls.push(renderStruct(typeName, node.members, sf, decls));
    return { swift: typeName, optional: false };
  }
  if (ts.isUnionTypeNode(node)) {
    return mapUnion(node, sf, typeName, decls);
  }
  throw new Error(
    `gen-bridge: unsupported type for "${typeName}": ${node.getText(sf)}`
  );
}

function mapUnion(
  node: ts.UnionTypeNode,
  sf: ts.SourceFile,
  typeName: string,
  decls: string[]
): { swift: string; optional: boolean } {
  let optional = false;
  const real: ts.TypeNode[] = [];
  for (const t of node.types) {
    const isNull =
      ts.isLiteralTypeNode(t) && t.literal.kind === ts.SyntaxKind.NullKeyword;
    if (t.kind === ts.SyntaxKind.UndefinedKeyword || isNull) {
      optional = true;
      continue;
    }
    real.push(t);
  }

  // All string literals → a String-raw enum.
  const allStringLiterals = real.every(
    (t) => ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)
  );
  if (real.length > 0 && allStringLiterals) {
    const values = real.map((t) =>
      ((t as ts.LiteralTypeNode).literal as ts.StringLiteral).text
    );
    decls.push(renderStringEnum(typeName, values));
    return { swift: typeName, optional };
  }

  // string | { …object literal… } → a custom Decodable enum.
  const strings = real.filter((t) => t.kind === ts.SyntaxKind.StringKeyword);
  const objects = real.filter((t): t is ts.TypeLiteralNode =>
    ts.isTypeLiteralNode(t)
  );
  const [objectType] = objects;
  if (real.length === 2 && strings.length === 1 && objectType !== undefined) {
    const customName = `${typeName}Custom`;
    decls.push(renderStruct(customName, objectType.members, sf, decls));
    decls.push(renderMixedEnum(typeName, customName));
    return { swift: typeName, optional };
  }

  throw new Error(
    `gen-bridge: unsupported union for "${typeName}": ${node.getText(sf)}`
  );
}

function renderStruct(
  name: string,
  members: ts.NodeArray<ts.TypeElement>,
  sf: ts.SourceFile,
  decls: string[]
): string {
  const fields: string[] = [];
  for (const m of members) {
    if (!ts.isPropertySignature(m) || !m.name || !m.type) continue;
    const propName = m.name.getText(sf);
    const mapped = mapType(m.type, sf, name + pascal(propName), decls);
    const optional = m.questionToken !== undefined || mapped.optional;
    fields.push(`    let ${propName}: ${mapped.swift}${optional ? '?' : ''}`);
  }
  return `struct ${name}: Decodable {\n${fields.join('\n')}\n}`;
}

function renderStringEnum(name: string, values: string[]): string {
  const cases = values.map((value) => {
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
      return SWIFT_KEYWORDS.has(value)
        ? `    case \`${value}\``
        : `    case ${value}`;
    }
    // Non-identifier raw value (e.g. hyphenated) → camelCase case = "raw".
    const id = value
      .replace(/[^A-Za-z0-9]+(.)/g, (_, c: string) => c.toUpperCase())
      .replace(/[^A-Za-z0-9]/g, '');
    return `    case ${id} = "${value}"`;
  });
  return `enum ${name}: String, Decodable {\n${cases.join('\n')}\n}`;
}

function renderMixedEnum(name: string, customName: string): string {
  return `enum ${name}: Decodable {
    case named(String)
    case custom(${customName})

    init(from decoder: Decoder) throws {
        if let single = try? decoder.singleValueContainer(),
           let value = try? single.decode(String.self) {
            self = .named(value)
            return
        }
        self = .custom(try ${customName}(from: decoder))
    }
}`;
}

function renderTypesFile(sf: ts.SourceFile): string {
  const decls: string[] = [];
  for (const name of TYPE_INTERFACES) {
    const iface = findInterface(sf, name);
    decls.push(renderStruct(name, iface.members, sf, decls));
  }
  return `//
//  GalvaBridgeTypes.swift
//  @galva/react-native
//
//  AUTO-GENERATED from src/native/GalvaNative.ts by scripts/gen-bridge.ts.
//  Do NOT edit by hand — run "npm run gen:bridge". "npm run check:bridge" fails
//  if this file is stale.
//
//  Decodable mirrors of the JS object payloads, so the Swift bridge parses them
//  confidently (see GalvaBridgeDecoding.swift for the NSDictionary → struct
//  helper). A field renamed/added in GalvaNative.ts changes these types, which
//  surfaces as a compile error in the bridge mappers — not a silent runtime drop.
//

import Foundation

${decls.join('\n\n')}
`;
}

// ---------------------------------------------------------------------------
// Generate / check
// ---------------------------------------------------------------------------

const sf = sourceFile();
const methods = parseMethods(sf);
const moduleM = renderModuleM(methods);
const typesSwift = renderTypesFile(sf);

if (process.argv.includes('--check')) {
  let ok = true;

  if (readFileSync(M_PATH, 'utf8') !== moduleM) {
    ok = false;
    console.error('✗ ios/bridge/GalvaModule.m is out of date — run "npm run gen:bridge".');
  }
  if (readFileSync(TYPES_PATH, 'utf8') !== typesSwift) {
    ok = false;
    console.error('✗ ios/bridge/GalvaBridgeTypes.swift is out of date — run "npm run gen:bridge".');
  }

  const swift = readFileSync(SWIFT_PATH, 'utf8');
  const swiftSelectors = new Set<string>(
    [...swift.matchAll(/@objc\(([^)]+)\)\s*func\b/g)].flatMap((m) =>
      m[1] ? [m[1]] : []
    )
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
    `✓ Bridge in sync — ${methods.length} methods + ${TYPE_INTERFACES.length} payload types: ` +
      `GalvaModule.m / GalvaBridgeTypes.swift match GalvaNative.ts and every Swift @objc selector is present.`
  );
} else {
  writeFileSync(M_PATH, moduleM);
  writeFileSync(TYPES_PATH, typesSwift);
  console.log(
    `Generated GalvaModule.m (${methods.length} methods) + GalvaBridgeTypes.swift (${TYPE_INTERFACES.length} types) from GalvaNative.ts.`
  );
}
