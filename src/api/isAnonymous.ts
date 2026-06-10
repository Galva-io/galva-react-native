import { GalvaNative } from '../NativeBridge';

/**
 * Whether the current identity is anonymous (no user identified via
 * {@link identify}).
 */
export function isAnonymous(): Promise<boolean> {
  return GalvaNative.isAnonymous();
}
