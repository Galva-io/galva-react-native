#!/usr/bin/env bun
//
// gen-version.ts  (run with bun)
//
// Generates src/version.ts from the "version" field in package.json — the single
// source of truth for the JS package version.
//
// The SDK reports this to the Galva backend as the SDK-identity header
// `react-native-<platform>/<version>` (see src/api/configure.ts), so a stale
// constant would make React Native installs untraceable — indistinguishable from
// the native iOS core they wrap. Generating + checking it removes the "bumped
// package.json, forgot the constant" failure mode entirely.
//
//   • `npm run gen:version`   — (re)write src/version.ts from package.json.
//   • `npm run check:version` — fail if src/version.ts is stale (CI guard).
//
// Bumping the package version is one edit to package.json + `npm run gen:version`;
// CI fails the build if you forget.
//

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKG_PATH = join(root, 'package.json');
const VERSION_PATH = join(root, 'src/version.ts');

const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf8')) as { version?: unknown };
if (typeof pkg.version !== 'string' || pkg.version.length === 0) {
  throw new Error('gen-version: package.json "version" is missing or not a string');
}
const version = pkg.version;

const contents = `//
//  version.ts
//  @galva/react-native
//
//  AUTO-GENERATED from package.json by scripts/gen-version.ts.
//  Do NOT edit by hand — run "npm run gen:version". "npm run check:version"
//  fails if this file is stale.
//
//  The JS package version, reported to the Galva backend as the SDK-identity
//  header "react-native-<platform>/<version>" (see src/api/configure.ts). Lives
//  in its own module so src/api/configure.ts can import it without a cycle
//  through src/index.ts.
//

/** The @galva/react-native package version. The native core version is a
 *  separate value — read it with \`getSDKVersion()\`. */
export const VERSION = '${version}';
`;

if (process.argv.includes('--check')) {
  const current = readFileSync(VERSION_PATH, 'utf8');
  if (current !== contents) {
    console.error('✗ src/version.ts is out of date — run "npm run gen:version".');
    process.exit(1);
  }
  console.log(`✓ src/version.ts matches package.json (${version}).`);
} else {
  writeFileSync(VERSION_PATH, contents);
  console.log(`Generated src/version.ts (VERSION = ${version}).`);
}
