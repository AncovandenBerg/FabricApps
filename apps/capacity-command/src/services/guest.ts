// Shared-link guest identity. Guests never authenticate: the data plane
// serves them through the anonymous role (publishable key only), and this
// browser-local id is what telemetry and saved progress are keyed on.
import type { AuthUser } from './IAuthService';

const GUEST_ID_KEY = 'capacity-command:guest-id';

function toGuestUser(id: string): AuthUser {
  return { id, email: '', name: 'Guest', isGuest: true };
}

/** The guest user for this browser, when guest mode was chosen before. */
export function activeGuestUser(): AuthUser | null {
  try {
    const id = localStorage.getItem(GUEST_ID_KEY);
    return id ? toGuestUser(id) : null;
  } catch {
    return null;
  }
}

/** Enter guest mode, minting a stable per-browser id on first use. */
export function startGuestSession(): AuthUser {
  let id: string | null = null;
  try {
    id = localStorage.getItem(GUEST_ID_KEY);
    if (!id) {
      id = `guest-${crypto.randomUUID()}`;
      localStorage.setItem(GUEST_ID_KEY, id);
    }
  } catch {
    id = `guest-${crypto.randomUUID()}`;
  }
  return toGuestUser(id);
}

export function endGuestSession(): void {
  try {
    localStorage.removeItem(GUEST_ID_KEY);
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}
