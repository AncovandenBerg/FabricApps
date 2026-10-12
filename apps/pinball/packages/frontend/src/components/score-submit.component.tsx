import { useState } from 'react';

import type { GameResult } from './pinball-game.component';
import { RetroButton, RetroWindow } from './retro-chrome.component';

import type { NewHighScore } from '@/hooks/use-high-scores';

type SubmitState = 'idle' | 'saving' | 'saved' | 'error';

export function ScoreSubmit({
  result,
  defaultName,
  onSubmit,
  onDismiss,
}: {
  result: GameResult;
  defaultName: string;
  onSubmit: (entry: NewHighScore) => Promise<void>;
  onDismiss: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [state, setState] = useState<SubmitState>('idle');
  const [error, setError] = useState<string | null>(null);

  // There is deliberately no effect resetting this state between games: the
  // parent gives this panel a per-game `key`, so a new game remounts it and the
  // submission state starts clean without a render-cascading effect.
  const trimmed = name.trim();
  const canSubmit =
    trimmed.length > 0 && state !== 'saving' && state !== 'saved';

  const save = async () => {
    if (!canSubmit) return;
    setState('saving');
    setError(null);
    try {
      await onSubmit({
        playerName: trimmed.slice(0, 40),
        score: result.score,
        ballsPlayed: result.ballsPlayed,
        durationSeconds: result.durationSeconds,
        targetBanksCleared: result.targetBanksCleared,
      });
      setState('saved');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Your score could not be saved.'
      );
      setState('error');
    }
  };

  return (
    <RetroWindow
      title={state === 'saved' ? 'Score Posted' : 'New High Score'}
      bodyClassName="p-300"
    >
      <p className="text-200 text-black">
        <span className="font-numeric text-400">
          {result.score.toLocaleString()}
        </span>{' '}
        points · {result.targetBanksCleared} target bank
        {result.targetBanksCleared === 1 ? '' : 's'} cleared
      </p>

      {state === 'saved' ? (
        <RetroButton className="mt-300 w-full" onClick={onDismiss}>
          Close
        </RetroButton>
      ) : (
        <form
          className="mt-300 flex flex-col gap-200"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label htmlFor="player-name" className="text-200 text-black">
            Name on the board:
          </label>
          <input
            id="player-name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            className="bevel-sunken bg-white px-200 py-100 text-200 text-black focus-visible:outline-none"
          />
          <div className="mt-100 flex gap-200">
            <RetroButton type="submit" className="flex-1" disabled={!canSubmit}>
              {state === 'saving' ? 'Posting…' : 'OK'}
            </RetroButton>
            <RetroButton className="flex-1" onClick={onDismiss}>
              Cancel
            </RetroButton>
          </div>
          {error ? (
            <p role="alert" className="text-200 text-destructive">
              {error}
            </p>
          ) : null}
        </form>
      )}
    </RetroWindow>
  );
}
