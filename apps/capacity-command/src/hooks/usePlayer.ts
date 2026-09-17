// The local player, as React state. Replaces the auth context of the
// Fabric-hosted version: identity is created on first visit, never verified.

import { useCallback, useState } from 'react';

import {
  clearPlayer,
  DEFAULT_NAME,
  ensurePlayer,
  savePlayer,
  type Player,
} from '@/game/player';
import { clearProgress } from '@/game/progress';
import { clearTelemetry } from '@/game/telemetry';

/** Keeps the header, avatar and profile card from breaking on pasted essays. */
const MAX_NAME_LENGTH = 40;

export interface PlayerState {
  player: Player;
  /** Set the display name; blank falls back to "Guest". */
  rename: (name: string) => void;
  /** Wipe this browser's progress, telemetry and identity, then start over. */
  reset: () => void;
}

export function usePlayer(): PlayerState {
  const [player, setPlayer] = useState<Player>(ensurePlayer);

  const rename = useCallback(
    (name: string) => {
      const next: Player = {
        ...player,
        name: name.trim().slice(0, MAX_NAME_LENGTH) || DEFAULT_NAME,
      };
      savePlayer(next);
      setPlayer(next);
    },
    [player]
  );

  const reset = useCallback(() => {
    clearProgress(player.id);
    clearTelemetry();
    clearPlayer();
    setPlayer(ensurePlayer());
  }, [player.id]);

  return { player, rename, reset };
}
