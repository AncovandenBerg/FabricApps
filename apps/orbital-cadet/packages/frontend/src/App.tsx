import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  PinballGame,
  type GameResult,
} from './components/pinball-game.component';

import { Leaderboard } from '@/components/leaderboard.component';
import {
  RetroButton,
  RetroMenuBar,
  RetroMenuItem,
  RetroStatusCell,
  RetroWell,
  RetroWindow,
} from '@/components/retro-chrome.component';
import { ScoreSubmit } from '@/components/score-submit.component';
import type { PinballEngine } from '@/game/engine';
import { INITIAL_HUD, type HudState } from '@/game/hud';
import { useAuth } from '@/hooks/auth.context';
import { useHighScores } from '@/hooks/use-high-scores';

function nameFromEmail(email: string | undefined): string {
  if (!email) return 'Cadet';
  const local = email.split('@')[0] ?? '';
  const words = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return words.join(' ') || 'Cadet';
}

/**
 * A Windows 95 desktop holding two windows: the table and its high scores.
 *
 * Splitting them is the period-correct arrangement — the original kept scores
 * in a separate dialog — and it also keeps the Fabric-backed leaderboard
 * permanently visible, which a modal dialog would hide.
 */
function App() {
  const { session } = useAuth();
  const { scores, status, error, refresh, submit } = useHighScores();
  const [result, setResult] = useState<GameResult | null>(null);
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [engine, setEngine] = useState<PinballEngine | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  // Keys the submit panel so each finished game gets a fresh one.
  const [gameId, setGameId] = useState(0);
  const scoresRef = useRef<HTMLDivElement | null>(null);

  const handleGameOver = useCallback((next: GameResult) => {
    setGameId((n) => n + 1);
    setResult(next.score > 0 ? next : null);
  }, []);

  const dismiss = useCallback(() => setResult(null), []);
  const retry = useCallback(() => void refresh(), [refresh]);

  return (
    <div className="min-h-full bg-desktop lg:h-screen lg:overflow-hidden">
      <div className="flex h-full flex-col items-center gap-400 p-400 lg:flex-row lg:items-stretch lg:justify-center">
        {/* The table window takes its height from the canvas, which is sized in
            pixels, so it is centred rather than stretched. The high-score
            window stretches to the row instead. */}
        <RetroWindow
          title="3D Pinball — Orbital Cadet"
          headingLevel={1}
          className="w-full min-w-0 shrink-0 lg:w-auto lg:self-center"
        >
          <RetroMenuBar>
            <RetroMenuItem onClick={() => engine?.startGame()}>
              <u>N</u>ew Game
            </RetroMenuItem>
            <RetroMenuItem
              onClick={() =>
                scoresRef.current?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              High <u>S</u>cores
            </RetroMenuItem>
            <RetroMenuItem onClick={() => setHelpOpen((v) => !v)}>
              <u>H</u>elp
            </RetroMenuItem>
          </RetroMenuBar>

          <RetroWell className="flex justify-center">
            <PinballGame
              onGameOver={handleGameOver}
              onHud={setHud}
              onEngine={setEngine}
            />
          </RetroWell>

          <div className="grid shrink-0 grid-cols-3 gap-100 pt-100 lg:hidden">
            <TouchControl
              label="Left flipper"
              onHold={(v) => engine?.setFlipper('left', v)}
            >
              Left
            </TouchControl>
            <TouchControl
              label="Plunger"
              onHold={(v) => engine?.setPlunger(v)}
            >
              Launch
            </TouchControl>
            <TouchControl
              label="Right flipper"
              onHold={(v) => engine?.setFlipper('right', v)}
            >
              Right
            </TouchControl>
          </div>

          <div className="grid shrink-0 grid-cols-[1fr_auto_auto_auto] gap-100 pt-100">
            <RetroStatusCell label="SCORE">
              <span className="font-numeric text-300 text-black">
                {hud.score.toLocaleString()}
              </span>
            </RetroStatusCell>
            <RetroStatusCell label="BALL">
              <span className="font-numeric text-300 text-black">
                {hud.ballNumber === 0
                  ? '—'
                  : `${hud.ballNumber}/${hud.totalBalls}`}
              </span>
            </RetroStatusCell>
            <RetroStatusCell label="TARGETS">
              <span className="font-numeric text-300 text-black">
                {targetLabel(hud.targetsDown)}
              </span>
            </RetroStatusCell>
            <RetroStatusCell label="BANKS">
              <span className="font-numeric text-300 text-black">
                {hud.banks}
              </span>
            </RetroStatusCell>
          </div>
        </RetroWindow>

        <div
          ref={scoresRef}
          className="flex w-full min-w-0 flex-col gap-400 lg:w-[320px] lg:shrink-0"
        >
          {helpOpen ? (
            <RetroWindow title="Help — Controls" bodyClassName="p-300">
              <dl className="flex flex-col gap-200 text-200 text-black">
                <HelpRow term="New game" detail="Space or Enter" />
                <HelpRow term="Launch ball" detail="Hold Space, release" />
                <HelpRow term="Left flipper" detail="← or A" />
                <HelpRow term="Right flipper" detail="→ or D" />
              </dl>
              <p className="mt-300 text-200 leading-200 text-black">
                Click the table first so it has keyboard focus. A short plunger
                pull scores better than a full one.
              </p>
              <RetroButton
                className="mt-300 w-full"
                onClick={() => setHelpOpen(false)}
              >
                Close
              </RetroButton>
            </RetroWindow>
          ) : null}

          {result ? (
            <ScoreSubmit
              key={gameId}
              result={result}
              defaultName={nameFromEmail(session?.user?.email)}
              onSubmit={submit}
              onDismiss={dismiss}
            />
          ) : null}

          <Leaderboard
            scores={scores}
            status={status}
            error={error}
            currentUserId={session?.user?.id ?? null}
            onRetry={retry}
          />
        </div>
      </div>
    </div>
  );
}

function targetLabel(down: number): string {
  return `${down}/3`;
}

function HelpRow({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="flex items-baseline justify-between gap-200">
      <dt>{term}</dt>
      <dd className="font-monospace">{detail}</dd>
    </div>
  );
}

function TouchControl({
  label,
  onHold,
  children,
}: {
  label: string;
  onHold: (engaged: boolean) => void;
  children: ReactNode;
}) {
  return (
    <RetroButton
      aria-label={label}
      className="select-none py-300"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onPointerLeave={() => onHold(false)}
    >
      {children}
    </RetroButton>
  );
}

export default App;
