//
// GalvaError — the typed error thrown by rejecting Galva calls (today, only
// `showMessage`). Carries a stable `code` you can branch on.
//

export type GalvaErrorCode =
  | 'NOT_CONFIGURED'
  | 'MESSAGE_NOT_FOUND'
  | 'BUNDLE_UNAVAILABLE'
  | 'BRIDGE_PROTOCOL_MISMATCH'
  | 'NO_ACTIVE_SCENE'
  | 'SHOW_FAILED'
  | 'UNKNOWN';

const KNOWN_CODES = new Set<string>([
  'NOT_CONFIGURED',
  'MESSAGE_NOT_FOUND',
  'BUNDLE_UNAVAILABLE',
  'BRIDGE_PROTOCOL_MISMATCH',
  'NO_ACTIVE_SCENE',
  'SHOW_FAILED',
]);

/** A Galva SDK error with a stable, branchable `code`. */
export class GalvaError extends Error {
  readonly code: GalvaErrorCode;

  constructor(code: GalvaErrorCode, message: string) {
    super(message);
    this.name = 'GalvaError';
    this.code = code;
    // Keep `instanceof GalvaError` working across down-level transpilation.
    Object.setPrototypeOf(this, GalvaError.prototype);
  }
}

/** Normalize a thrown value (native rejection or otherwise) into a GalvaError. */
export function toGalvaError(error: unknown): GalvaError {
  if (error instanceof GalvaError) return error;
  if (typeof error === 'object' && error !== null) {
    const e = error as { code?: unknown; message?: unknown };
    const code =
      typeof e.code === 'string' && KNOWN_CODES.has(e.code)
        ? (e.code as GalvaErrorCode)
        : 'UNKNOWN';
    const message =
      typeof e.message === 'string' ? e.message : 'Galva operation failed.';
    return new GalvaError(code, message);
  }
  return new GalvaError('UNKNOWN', 'Galva operation failed.');
}
