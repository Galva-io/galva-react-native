//
// Deep-link auto-wiring. Installed once by `configureSDK`, so developers get
// Galva deep links for free — no AppDelegate/scene edits. We piggyback on React
// Native's `Linking` API (works on Expo + bare): the cold-launch URL plus every
// subsequent `url` event are forwarded to the SDK, which claims only its own
// `gv…` links and ignores the rest.
//

import { Linking } from 'react-native';
import { handleDeepLink } from '../api/handleDeepLink';

let installed = false;

/** Idempotent — safe to call on every `configureSDK`. */
export function installDeepLinkForwarding(): void {
  if (installed) return;
  installed = true;

  Linking.getInitialURL()
    .then((url) => {
      if (url) void handleDeepLink(url).catch(() => undefined);
    })
    .catch(() => undefined);

  Linking.addEventListener('url', ({ url }) => {
    if (url) void handleDeepLink(url).catch(() => undefined);
  });
}
