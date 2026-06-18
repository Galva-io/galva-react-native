// Shared public types for the Galva surface (plan §4). Transcribed 1:1 from
// the vendored iOS core facade (ios/galva-src/Sources/Galva.swift).

/**
 * Backend the SDK talks to. `'production'` (default) and `'development'` are
 * Galva's SaaS environments; pass an object for on-prem / proxy setups.
 */
export type GalvaEnvironment =
  | 'production'
  | 'development'
  | {
      /** Base URL the SDK appends RPC paths to (`/sdk/initialize`, …). */
      apiBaseURL: string;
      /** Origin the SDK downloads versioned in-app message HTML bundles from. */
      webviewBundleCDN: string;
    };

/** Minimum severity for SDK log entries. Mirrors `Galva.LogLevel`. */
export type GalvaLogLevel =
  | 'debug'
  | 'info'
  | 'notice'
  | 'warning'
  | 'error'
  | 'fault'
  | 'off';

/** Options for {@link configure}. */
export interface GalvaConfig {
  /** Galva publishable API key. The server resolves appId + environment from it. */
  apiKey: string;
  /** Backend to talk to. Default: `'production'`. */
  environment?: GalvaEnvironment;
  /**
   * Emit `session_start` events automatically on cold start / foreground.
   * Default: `true`.
   */
  autoTrackLifecycle?: boolean;
  /** Minimum severity to log. Default: `'warning'`. */
  logLevel?: GalvaLogLevel;
}

/**
 * Loose event attribute bag. The SDK keeps everything JSON-compatible and
 * silently drops values that aren't.
 */
export type EventAttributes = Record<string, unknown>;

/** Value types accepted as user traits. */
export type UserPropertyValue = string | number | boolean;

/** Push provider for a device token. */
export type PushPlatform = 'apns' | 'fcm';

/** Communication channel a preference applies to. */
export type CommunicationChannel = 'email' | 'pushNotification' | 'inApp';

/** Options for {@link setCommunicationPreference}. */
export interface CommunicationPreference {
  /** Channel to update. */
  channel: CommunicationChannel;
  /** If `true`, disables the channel entirely. */
  disabled?: boolean;
  /**
   * Per-workflow toggles (workflow type → enabled). Common keys:
   * `"payment-recovery"`, `"prechurn-save"`, `"winback"`.
   */
  categories?: Record<string, boolean>;
}

/**
 * Workflow categories surfaced by the server. New values may be added over
 * time — treat unknown strings as a forward-compat case.
 */
export type WorkflowType =
  | 'prechurn-save'
  | 'payment-recovery'
  | 'trial-rescue';

/**
 * A pending in-app message addressed to the current identity. Receive these
 * through the {@link onMessage} emitter and pass `id` to {@link show} to render.
 */
export interface InAppMessage {
  /** Server-generated communication id — stable, safe as a dedupe key. */
  id: string;
  /** Workflow that triggered the message; `null` for broadcast/manual sends. */
  workflowType: WorkflowType | null;
  /** When the server queued the message (ms since epoch). */
  createdAt: number;
  /** Raw server-side type discriminator (e.g. `"trial-rescue-in-app"`) — for logging. */
  rawType: string;
}
