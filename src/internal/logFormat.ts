//
// Pure log formatting/routing helpers — NO React Native imports, so they're
// unit-testable under bun (scripts/test-logging.ts) without an RN runtime.
// internal/logging.ts wires these to the native event emitter.
//

import type {
  GalvaLogCategory,
  GalvaLogEntry,
  GalvaLogLevel,
  GalvaLogger,
} from '../types';

export type ConsoleMethod = 'debug' | 'info' | 'warn' | 'error';

// Uppercase prefix per level (standard-JS-logger style; `warning` → `WARN`).
const LABEL: Record<GalvaLogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO',
  notice: 'NOTICE',
  warning: 'WARN',
  error: 'ERROR',
  fault: 'FAULT',
  off: 'OFF',
};

// ANSI SGR color per level — renders in the Metro/terminal console (the usual RN
// dev surface). A browser-based debugger console would show the codes literally.
const COLOR: Record<GalvaLogLevel, string> = {
  debug: '\x1b[90m', // gray
  info: '\x1b[36m', // cyan
  notice: '\x1b[34m', // blue
  warning: '\x1b[33m', // yellow
  error: '\x1b[31m', // red
  fault: '\x1b[91m', // bright red
  off: '',
};

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

// Which console method carries each level (severity routing: warn→console.warn,
// so error overlays / level filters still work). `off` prints nothing.
const METHOD: Record<GalvaLogLevel, ConsoleMethod | null> = {
  debug: 'debug',
  info: 'info',
  notice: 'info',
  warning: 'warn',
  error: 'error',
  fault: 'error',
  off: null,
};

/**
 * Colored, level-prefixed header, e.g. `WARN  [galva:queue]` — the label is bold
 * + level-colored and the category dimmed (ANSI; rendered in the terminal).
 */
export function formatHeader(
  level: GalvaLogLevel,
  category: GalvaLogCategory
): string {
  const label = (LABEL[level] ?? String(level).toUpperCase()).padEnd(5);
  const color = COLOR[level] ?? '';
  return `${BOLD}${color}${label}${RESET} ${DIM}[galva:${category}]${RESET}`;
}

/**
 * Map a log entry to the console method + arguments to print, or `method: null`
 * for `level: 'off'`. Args are `[header, message, metadata?, error?]` — the
 * header carries the colored `WARN/ERROR/…` prefix + category.
 */
export function consoleCall(entry: GalvaLogEntry): {
  method: ConsoleMethod | null;
  args: unknown[];
} {
  const args: unknown[] = [formatHeader(entry.level, entry.category), entry.message];
  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    args.push(entry.metadata);
  }
  if (entry.error !== undefined) args.push(entry.error);

  // Forward-compat: an unknown level from a newer native core → info.
  const method = METHOD[entry.level] ?? 'info';
  return { method: entry.level === 'off' ? null : method, args };
}

/**
 * Route one entry. A custom logger (if set) wins and replaces the console sink;
 * a throwing custom logger never breaks the pipeline. Otherwise fall through to
 * the console sink.
 */
export function dispatchEntry(
  entry: GalvaLogEntry,
  customLogger: GalvaLogger | null,
  toConsole: (entry: GalvaLogEntry) => void
): void {
  if (customLogger) {
    try {
      customLogger(entry);
    } catch {
      // A misbehaving logger must not crash the SDK's event pipeline.
    }
    return;
  }
  toConsole(entry);
}
