//
// Native→JS log forwarding.
//
// The native bridge emits each SDK log entry that passes the configured
// `logLevel` as a `galva#log` event (see ios/bridge/GalvaLogBridge.swift). This
// routes those entries to:
//
//   • the dev console — default in `__DEV__` (the "same as iOS viewing"); or
//   • a custom logger installed via `setLogger` (forward to a remote log
//     server, Sentry, Datadog, …).
//
// Forwarding is switched on natively only when needed (console-in-dev or a
// custom logger is set), so release builds with neither pay nothing. On Android
// (no native core yet) this is a no-op.
//

import type { EmitterSubscription } from 'react-native';
import { GalvaNative, isGalvaLinked } from '../native/GalvaNative';
import { getGalvaEmitter } from '../native/events';
import { consoleCall, dispatchEntry } from './logFormat';
import type { GalvaLogEntry, GalvaLogger } from '../types';

/** Native event name carrying each forwarded entry. Matches the Swift bridge. */
const LOG_EVENT = 'galva#log';

let customLogger: GalvaLogger | null = null;
let consoleEnabled = false;
let subscription: EmitterSubscription | undefined;
let forwardingOn = false;

function printToConsole(entry: GalvaLogEntry): void {
  const { method, args } = consoleCall(entry);
  if (method) console[method](...args);
}

function dispatch(entry: GalvaLogEntry): void {
  dispatchEntry(entry, customLogger, (e) => {
    if (consoleEnabled) printToConsole(e);
  });
}

/** Reconcile the JS subscription + native forwarding flag with desired state. */
function sync(): void {
  if (!isGalvaLinked) return; // Android placeholder: no native logs to forward.

  const want = consoleEnabled || customLogger !== null;
  if (want && !subscription) {
    subscription = getGalvaEmitter().addListener(LOG_EVENT, (entry) =>
      dispatch(entry as GalvaLogEntry)
    );
  } else if (!want && subscription) {
    subscription.remove();
    subscription = undefined;
  }
  if (want !== forwardingOn) {
    forwardingOn = want;
    GalvaNative.setLogForwarding(want);
  }
}

/** Backing implementation of the public `setLogger`. */
export function setCustomLogger(logger: GalvaLogger | null): void {
  customLogger = logger;
  sync();
}

/**
 * Called by `configureSDK` — turns on dev-console viewing per `logToConsole`
 * (default `__DEV__`). A custom logger set via `setLogger` is unaffected.
 */
export function configureLogForwarding(logToConsole: boolean | undefined): void {
  consoleEnabled = logToConsole ?? __DEV__;
  sync();
}
