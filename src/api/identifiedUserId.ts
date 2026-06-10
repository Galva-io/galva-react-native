import { GalvaNative } from '../NativeBridge';

/**
 * Currently-identified end-user id, or `null` if no user has been identified
 * (or {@link logout} was called).
 */
export function identifiedUserId(): Promise<string | null> {
  return GalvaNative.identifiedUserId();
}
