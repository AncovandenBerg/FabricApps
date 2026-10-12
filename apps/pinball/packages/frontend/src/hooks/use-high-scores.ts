import type { HighScoreRecord } from '@rayfin-app/shared';
import { useCallback, useEffect, useState } from 'react';

import { getRayfinClient } from '@/lib/rayfin-client';

export type LoadStatus = 'loading' | 'ready' | 'error';

export interface NewHighScore {
  playerName: string;
  score: number;
  ballsPlayed: number;
  durationSeconds: number;
  targetBanksCleared: number;
}

const LEADERBOARD_SIZE = 25;

const FIELDS = [
  'id',
  'playerName',
  'score',
  'ballsPlayed',
  'durationSeconds',
  'targetBanksCleared',
  'createdAt',
  'owner_id',
] as const;

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'The leaderboard is unavailable right now.';
}

/**
 * The leaderboard, backed by the Rayfin data service.
 *
 * Reads are paginated rather than using `.execute()`: a plain execute returns a
 * single page and gives no signal that more rows exist, so a growing table is
 * silently truncated. One page of `LEADERBOARD_SIZE` is all this view wants,
 * and `executePaginated` makes that explicit instead of accidental.
 */
export function useHighScores() {
  const [scores, setScores] = useState<HighScoreRecord[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  // Fetching is kept free of state writes so the mount effect below can own
  // when they happen, and skip them entirely if it has already been torn down.
  const load = useCallback(async (): Promise<HighScoreRecord[]> => {
    const client = await getRayfinClient();
    const page = await client.data.HighScore.select([...FIELDS])
      .orderBy({ score: 'desc' })
      .first(LEADERBOARD_SIZE)
      .executePaginated();
    return page.items;
  }, []);

  const refresh = useCallback(async () => {
    try {
      setScores(await load());
      setStatus('ready');
      setError(null);
    } catch (err) {
      setError(describe(err));
      setStatus('error');
    }
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const items = await load();
        if (cancelled) return;
        setScores(items);
        setStatus('ready');
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(describe(err));
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  /**
   * `owner_id` is stamped from the live session rather than passed in, because
   * the entity policy only accepts a row whose owner matches the caller's own
   * subject claim. Taking it from anywhere else would just produce a row the
   * server refuses.
   */
  const submit = useCallback(
    async (entry: NewHighScore) => {
      const client = await getRayfinClient();
      const session = client.auth.getSession();
      if (!session.isAuthenticated || !session.user) {
        throw new Error('Sign in again to post your score.');
      }

      await client.data.HighScore.create({
        ...entry,
        createdAt: new Date(),
        owner_id: session.user.id,
      });

      await refresh();
    },
    [refresh]
  );

  return { scores, status, error, refresh, submit };
}
