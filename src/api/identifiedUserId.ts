import { GalvaNative } from '../NativeBridge';

/**
 * Currently-identified end-user id, or `null` if no user has been identified
 * (or {@link logout} was called).
 *
 * Reads a snapshot — an {@link identify} call is applied asynchronously by
 * the native core, so reading immediately after it may return the previous
 * state.
 */
export function identifiedUserId(): Promise<string | null> {
  return GalvaNative.identifiedUserId();
}
