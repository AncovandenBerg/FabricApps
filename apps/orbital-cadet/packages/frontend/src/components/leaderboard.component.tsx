import type { HighScoreRecord } from '@rayfin-app/shared';
import { memo } from 'react';

import { RetroButton, RetroWindow } from './retro-chrome.component';

import type { LoadStatus } from '@/hooks/use-high-scores';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * The Fabric-backed leaderboard, as a 95 list box.
 *
 * Memoised because the score readout re-renders `App` several times a second
 * during play, and none of those frames change the leaderboard.
 */
export const Leaderboard = memo(function Leaderboard({
  scores,
  status,
  error,
  currentUserId,
  onRetry,
}: {
  scores: HighScoreRecord[];
  status: LoadStatus;
  error: string | null;
  currentUserId: string | null;
  onRetry: () => void;
}) {
  return (
    <RetroWindow
      title="High Scores"
      className="min-h-[220px] w-full min-w-0 lg:h-full"
      bodyClassName="pt-100"
    >
      <div className="grid shrink-0 grid-cols-[32px_1fr_80px] gap-[1px] pb-[1px]">
        <ColumnHeader>#</ColumnHeader>
        <ColumnHeader>Player</ColumnHeader>
        <ColumnHeader>Score</ColumnHeader>
      </div>

      <div className="bevel-sunken min-h-0 flex-1 overflow-y-auto bg-white">
        {status === 'loading' ? (
          <p className="p-300 text-200 text-black">Reading high scores…</p>
        ) : null}

        {status === 'error' ? (
          <div className="p-300">
            <p role="alert" className="mb-300 text-200 text-black">
              {error ?? 'The leaderboard is unavailable right now.'}
            </p>
            <RetroButton onClick={onRetry}>Retry</RetroButton>
          </div>
        ) : null}

        {status === 'ready' && scores.length === 0 ? (
          <p className="p-300 text-200 text-black">
            No scores yet. Play a game and claim the top slot.
          </p>
        ) : null}

        {status === 'ready' && scores.length > 0 ? (
          <ol>
            {scores.map((entry, index) => {
              const mine =
                currentUserId !== null && entry.owner_id === currentUserId;
              return (
                <li
                  key={entry.id}
                  className={
                    mine
                      ? 'grid grid-cols-[32px_1fr_80px] items-baseline gap-100 bg-primary px-100 py-100-nudge text-200 text-primary-foreground'
                      : 'grid grid-cols-[32px_1fr_80px] items-baseline gap-100 px-100 py-100-nudge text-200 text-black'
                  }
                >
                  <span className="font-numeric text-100">{index + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate">
                      {entry.playerName}
                      {mine ? ' *' : ''}
                    </span>
                    <span
                      className={
                        mine
                          ? 'block text-100 text-white/70'
                          : 'block text-100 text-muted-foreground'
                      }
                    >
                      {formatDuration(entry.durationSeconds)} ·{' '}
                      {entry.targetBanksCleared} bank
                      {entry.targetBanksCleared === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="text-right font-numeric text-100">
                    {entry.score.toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
    </RetroWindow>
  );
});

function ColumnHeader({ children }: { children: React.ReactNode }) {
  return (
    <span className="bevel-raised bg-card px-100 py-100-nudge text-left text-100 text-black">
      {children}
    </span>
  );
}
