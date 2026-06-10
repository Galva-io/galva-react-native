import { GalvaNative } from '../NativeBridge';

/**
 * Validate an email address against Galva's ingestion rules. Use this to
 * surface a validation error in your own UI before calling
 * {@link registerEmail} (which silently drops invalid addresses).
 */
export function isValidEmail(email: string): Promise<boolean> {
  return GalvaNative.isValidEmail(email);
}
