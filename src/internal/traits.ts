//
// Maps the typed `GalvaUserAttributes` known-trait names to Galva's canonical
// `$gv_*` wire keys before they cross the bridge. The native bulk setter
// (`AppUser.set([String:Any])`) passes keys through verbatim, so a known trait
// sent as `email` would land as a *custom* trait — this is where `email` becomes
// `$gv_email`. Unknown keys pass through unchanged (custom traits).
//

import type { GalvaUserAttributes, GalvaValue } from '../types';

const TRAIT_WIRE_KEYS: Record<string, string> = {
  email: '$gv_email',
  fullName: '$gv_fullName',
  firstName: '$gv_firstName',
  lastName: '$gv_lastName',
  country: '$gv_country',
  timezone: '$gv_timezone',
  languageCode: '$gv_languageCode',
  totalLifetimeValue: '$gv_totalLifetimeValue',
};

/** Translate known trait names to wire keys; drop `undefined` values (they
 *  can't meaningfully cross the bridge). */
export function toWireAttributes(
  attributes: GalvaUserAttributes
): Record<string, GalvaValue> {
  const out: Record<string, GalvaValue> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined) continue;
    out[TRAIT_WIRE_KEYS[key] ?? key] = value;
  }
  return out;
}
