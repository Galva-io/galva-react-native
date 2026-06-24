//
// Pure log formatting/routing helpers — NO React Native imports, so they're
// unit-testable under bun (scripts/test-logging.ts) without an RN runtime.
// internal/logging.ts wires these to the native event emitter.
//

import type { GalvaLogEntry, GalvaLogger } from '../types';

export type ConsoleMethod = 'debug' | 'info' | 'warn' | 'error';

/**
 * Map a log entry to the console method + arguments to print, or `method: null`
 * for `level: 'off'`. Collapses the iOS level set onto the four console methods:
 * debug→debug, info/notice→info, warning→warn, error/fault→error.
 */
export function consoleCall(entry: GalvaLogEntry): {
  method: ConsoleMethod | null;
  args: unknown[];
} {
  const args: unknown[] = [`[galva:${entry.category}]`, entry.message];
  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    args.push(entry.metadata);
  }
  if (entry.error !== undefined) args.push(entry.error);

  switch (entry.level) {
    case 'debug':
      return { method: 'debug', args };
    case 'info':
    case 'notice':
      return { method: 'info', args };
    case 'warning':
      return { method: 'warn', args };
    case 'error':
    case 'fault':
      return { method: 'error', args };
    case 'off':
      return { method: null, args };
    default:
      // Forward-compat: an unknown level from a newer native core → info.
      return { method: 'info', args };
  }
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
