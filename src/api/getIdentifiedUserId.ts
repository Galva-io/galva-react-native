import { GalvaNative } from '../native/GalvaNative';

/**
 * The currently identified user id, or `null` if anonymous.
 *
 * @example
 * const userId = await getIdentifiedUserId();
 */
export function getIdentifiedUserId(): Promise<string | null> {
  return GalvaNative.getIdentifiedUserId();
}
