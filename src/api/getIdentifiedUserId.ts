import { GalvaNative } from '../native/GalvaNative';

/** The currently identified user id, or `null` if anonymous. */
export function getIdentifiedUserId(): Promise<string | null> {
  return GalvaNative.getIdentifiedUserId();
}
