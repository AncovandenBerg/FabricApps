// Local player identity. There is no sign-in: every visitor is a guest, and
// this browser-local id is what saved progress and telemetry are keyed on.
// The display name is cosmetic and editable from the profile tab.

const PLAYER_KEY = 'capacity-command:player';

export const DEFAULT_NAME = 'Guest';

export interface Player {
  /** Stable per-browser id, e.g. `guest-3f2a...`. */
  id: string;
  name: string;
}

function newPlayer(): Player {
  return { id: `guest-${crypto.randomUUID()}`, name: DEFAULT_NAME };
}

/** The player stored in this browser, or null on first visit. */
export function activePlayer(): Player | null {
  try {
    const stored = localStorage.getItem(PLAYER_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<Player>;
    if (!parsed.id) return null;
    return { id: parsed.id, name: parsed.name?.trim() || DEFAULT_NAME };
  } catch {
    return null;
  }
}

export function savePlayer(player: Player): void {
  try {
    localStorage.setItem(PLAYER_KEY, JSON.stringify(player));
  } catch {
    // Storage full or blocked: play continues, it just won't be remembered.
  }
}

/**
 * The player for this browser, minting one on first visit. Falls back to an
 * in-memory identity when storage is unavailable (private mode, blocked
 * cookies), so the game is always playable.
 */
export function ensurePlayer(): Player {
  const existing = activePlayer();
  if (existing) return existing;
  const player = newPlayer();
  savePlayer(player);
  return player;
}

export function clearPlayer(): void {
  try {
    localStorage.removeItem(PLAYER_KEY);
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}
