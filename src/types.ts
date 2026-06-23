//
// Public type surface for @galva/react-native.
//
// These mirror the Galva iOS core's facade (Galva / AppEvents / AppUser /
// Communication / InAppMessages). Kept deliberately strict and JSON-clean:
// values that cross the bridge are limited to string | number | boolean.
//

/**
 * Galva runtime environment.
 *
 * - `'production'` (default) / `'development'` — Galva-hosted backends.
 * - A custom object — point the SDK at your own API + WebView bundle CDN.
 */
export type GalvaEnvironment =
  | 'production'
  | 'development'
  | {
      readonly apiBaseURL: string;
      readonly webviewBundleCDN: string;
    };

/** SDK log verbosity. Maps 1:1 to the iOS core's `LogLevel`. */
export type GalvaLogLevel =
  | 'debug'
  | 'info'
  | 'notice'
  | 'warning'
  | 'error'
  | 'fault'
  | 'off';

/** Options accepted by `configure`. */
export interface GalvaConfig {
  /** Publishable API key (`gv_pub_…`). */
  readonly apiKey: string;
  /** Backend selection. Defaults to `'production'`. */
  readonly environment?: GalvaEnvironment;
  /** Log verbosity. Defaults to `'warning'`. */
  readonly logLevel?: GalvaLogLevel;
  /** Auto-track app lifecycle (session_start). Defaults to `true`. */
  readonly autoTrackLifecycle?: boolean;
}

/** A value accepted as an event attribute or user property. */
export type GalvaValue = string | number | boolean;

/** Bag of event attributes / user properties. */
export type GalvaAttributes = Readonly<Record<string, GalvaValue>>;

/** Push token transport. */
export type GalvaPushPlatform = 'apns' | 'fcm';

/** Communication channel for preference control. */
export type GalvaCommunicationChannel = 'email' | 'push';

/** A known Galva workflow; forward-compatible with future server values. */
export type GalvaWorkflowType =
  | 'trialRescue'
  | 'paymentRecovery'
  | 'subscriberRescue'
  | 'winback'
  | (string & {});

/**
 * An in-app message surfaced by the SDK. Ids come from the message emitter and
 * are passed back to `show` to present the message.
 */
export interface GalvaInAppMessage {
  readonly id: string;
  /** Creation time, epoch milliseconds. */
  readonly createdAt: number;
  /** Raw server message type. */
  readonly rawType: string;
  /** Parsed workflow type, when the server provides one. */
  readonly workflowType?: GalvaWorkflowType;
}
