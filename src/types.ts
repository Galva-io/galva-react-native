//
// Public type surface for @galva/react-native.
//
// Mirrors the Galva iOS core facade (Galva / AppEvents / AppUser /
// InAppMessages). Values that cross the bridge are JSON-clean by construction.
//

/**
 * Galva runtime environment.
 *
 * - `'production'` (default) / `'development'` — Galva-hosted backends.
 * - a custom object — point the SDK at your own API + WebView bundle CDN.
 */
export type GalvaEnvironment =
  | 'production'
  | 'development'
  | {
      apiBaseURL: string;
      webviewBundleCDN: string;
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

/** Options accepted by `configureSDK`. */
export interface GalvaConfig {
  /** Publishable API key (`gv_pub_…`). */
  readonly apiKey: string;
  /** Backend selection. Defaults to `'production'`. */
  readonly environment?: GalvaEnvironment;
  /** Log verbosity. Defaults to `'warning'`. */
  readonly logLevel?: GalvaLogLevel;
  /** Automatic event collection. Both categories default to `true`. */
  readonly autoTrack?: {
    /** Auto-track app lifecycle (`session_start`). */
    readonly lifecycle?: boolean;
    /** Resolve Apple Search Ads attribution once per install. */
    readonly appleSearchAds?: boolean;
  };
}

/** A scalar value accepted as a user attribute. */
export type GalvaValue = string | number | boolean | null;

/** A JSON value accepted as an event attribute (scalars may nest). */
export type GalvaJSONValue =
  | GalvaValue
  | GalvaJSONValue[]
  | { [key: string]: GalvaJSONValue };

/** Bag of event attributes passed to `trackEvent`. */
export type GalvaAttributes = Record<string, GalvaJSONValue>;

/**
 * User attributes passed to `setUserAttributes`. Known traits are typed and
 * mapped to Galva's canonical wire keys; any additional key is sent as a
 * custom trait.
 */
export interface GalvaUserAttributes {
  email?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  timezone?: string;
  languageCode?: string;
  totalLifetimeValue?: number;
  [key: string]: GalvaValue | undefined;
}

/** A forwarded notification interaction (manual / opt-out path). */
export interface GalvaNotificationResponse {
  /** The notification's identifier (from your push library). */
  id: string;
  /** The APNs payload `userInfo`. */
  userInfo: Record<string, unknown>;
  /** `'default'` (a tap, the default) or `'dismiss'`. */
  action?: 'default' | 'dismiss';
}

/** A known Galva workflow; forward-compatible with future server values. */
export type GalvaWorkflowType =
  | 'prechurn-save'
  | 'payment-recovery'
  | 'trial-rescue'
  | (string & {});

/** An in-app message surfaced by the SDK. Pass `id` to `showMessage`. */
export interface GalvaInAppMessage {
  readonly id: string;
  /** Creation time, epoch milliseconds. */
  readonly createdAt: number;
  /** Raw server message type (e.g. `"trial-rescue-in-app"`). */
  readonly rawType: string;
  /** Parsed workflow type, when the server provides one. */
  readonly workflowType?: GalvaWorkflowType;
}

/** A removable event subscription (returned by `addMessageObserver`). */
export interface GalvaSubscription {
  remove(): void;
}
