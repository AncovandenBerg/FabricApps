import { useCallback, useEffect, useRef, useState } from 'react';

import { RetroButton } from './retro-chrome.component';

import { PinballEngine } from '@/game/engine';
import { INITIAL_HUD, sameHud, type HudState } from '@/game/hud';
import { playfieldSize } from '@/game/layout';
import { BUFFER_HEIGHT, BUFFER_WIDTH, renderTable } from '@/game/render';
import { DROP_TARGETS } from '@/game/table';

export interface GameResult {
  score: number;
  ballsPlayed: number;
  durationSeconds: number;
  targetBanksCleared: number;
}

const LEFT_KEYS = new Set(['ArrowLeft', 'KeyA', 'ShiftLeft']);
const RIGHT_KEYS = new Set(['ArrowRight', 'KeyD', 'ShiftRight']);

export function PinballGame({
  onGameOver,
  onHud,
  onEngine,
}: {
  onGameOver: (result: GameResult) => void;
  onHud: (hud: HudState) => void;
  onEngine?: (engine: PinballEngine) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onGameOverRef = useRef(onGameOver);
  const onHudRef = useRef(onHud);
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  // The simulation outlives every render, so it is created once and kept in
  // state rather than a ref: the on-screen controls need it during render, and
  // reading a ref there is exactly what React tells you not to do.
  const [engine] = useState(() => new PinballEngine());

  // Kept in refs so a new callback identity cannot tear down the game loop.
  useEffect(() => {
    onGameOverRef.current = onGameOver;
    onHudRef.current = onHud;
  }, [onGameOver, onHud]);

  useEffect(() => {
    onEngine?.(engine);
  }, [engine, onEngine]);

  const start = useCallback(() => {
    engine.startGame();
  }, [engine]);

  // Sized in pixels rather than CSS — see `playfieldSize` for why.
  useEffect(() => {
    const compute = () =>
      setSize(playfieldSize(window.innerWidth, window.innerHeight));
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  // One animation loop for the lifetime of the component. The canvas has a
  // fixed low-resolution backing store and is stretched by CSS, so there is
  // nothing to observe or resize here — that is the whole point of the
  // pixel-upscale approach.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let frame = 0;
    let last = performance.now();
    let lastHud = INITIAL_HUD;

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      engine.update(dt);

      for (const event of engine.drainEvents()) {
        if (event.kind === 'gameover') {
          onGameOverRef.current({
            score: engine.state.score,
            ballsPlayed: engine.state.totalBalls,
            durationSeconds: Math.round(engine.state.elapsed),
            targetBanksCleared: engine.state.targetBanksCleared,
          });
        }
      }

      renderTable(ctx, engine.state, now / 1000);

      const next: HudState = {
        score: engine.state.score,
        ballNumber: engine.state.ballNumber,
        totalBalls: engine.state.totalBalls,
        phase: engine.state.phase,
        plunger: engine.state.plunger,
        targetsDown: DROP_TARGETS.filter(
          (t) => engine.state.targetsDown[t.id]
        ).length,
        banks: engine.state.targetBanksCleared,
      };
      if (!sameHud(next, lastHud)) {
        lastHud = next;
        setHud(next);
        onHudRef.current(next);
      }

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [engine]);

  // Keyboard control. Bound to the window so the player never has to hunt for
  // focus mid-ball, but it yields to text entry so the name field still works.
  useEffect(() => {
    const isTyping = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable);

    const down = (e: KeyboardEvent) => {
      if (e.repeat || isTyping(e.target)) return;
      if (LEFT_KEYS.has(e.code)) {
        e.preventDefault();
        engine.setFlipper('left', true);
      } else if (RIGHT_KEYS.has(e.code)) {
        e.preventDefault();
        engine.setFlipper('right', true);
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (engine.state.phase === 'ready' || engine.state.phase === 'over') {
          engine.startGame();
        } else {
          engine.setPlunger(true);
        }
      } else if (e.code === 'Enter') {
        e.preventDefault();
        if (engine.state.phase === 'ready' || engine.state.phase === 'over') {
          engine.startGame();
        }
      }
    };

    const up = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (LEFT_KEYS.has(e.code)) engine.setFlipper('left', false);
      else if (RIGHT_KEYS.has(e.code)) engine.setFlipper('right', false);
      else if (e.code === 'Space') engine.setPlunger(false);
    };

    const blur = () => {
      engine.setFlipper('left', false);
      engine.setFlipper('right', false);
      engine.setPlunger(false);
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [engine]);

  const idle = hud.phase === 'ready' || hud.phase === 'over';

  return (
    <div
      className="relative shrink-0"
      style={size ? { width: size.w, height: size.h } : undefined}
    >
      <canvas
        ref={canvasRef}
        width={BUFFER_WIDTH}
        height={BUFFER_HEIGHT}
        className="pixelated block h-full w-full"
        role="img"
        aria-label="Pinball playfield"
      />

      {idle ? (
        <div className="absolute inset-0 flex items-center justify-center p-400">
          <div className="bevel-raised max-w-[260px] bg-card p-400 text-center">
            <p className="text-400 font-bold text-black">
              {hud.phase === 'over' ? 'Game Over' : '3D Pinball'}
            </p>
            {hud.phase === 'over' ? (
              <p className="mt-200 font-numeric text-600 text-black">
                {hud.score.toLocaleString()}
              </p>
            ) : (
              <p className="mt-200 text-200 leading-200 text-black">
                Three balls. Hold the plunger to set your launch, then keep it
                off the drain.
              </p>
            )}
            <RetroButton className="mt-400 w-full" onClick={start}>
              {hud.phase === 'over' ? 'Play Again' : 'New Game'}
            </RetroButton>
          </div>
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {`Ball ${hud.ballNumber} of ${hud.totalBalls}. Score ${hud.score}.`}
      </p>
    </div>
  );
}
