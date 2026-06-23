import { GalvaNative } from '../native/GalvaNative';
import { toGalvaError } from '../GalvaError';

/**
 * Present a pending in-app message. Pass an `id` received from
 * `addMessageObserver` / `useInAppMessages`. Rejects with a `GalvaError`
 * (e.g. `MESSAGE_NOT_FOUND`, `BUNDLE_UNAVAILABLE`) if it can't be shown.
 */
export async function showMessage(messageId: string): Promise<void> {
  try {
    await GalvaNative.showMessage(messageId);
  } catch (error) {
    throw toGalvaError(error);
  }
}
