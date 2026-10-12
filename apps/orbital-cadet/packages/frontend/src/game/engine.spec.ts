import { describe, expect, it } from 'vitest';

import { PinballEngine, type GameEvent } from './engine';
import { BALL_RADIUS, FLIPPERS, LANE, TABLE } from './table';

const STEP = 1 / 60;

/**
 * The furthest left the ball gets during `seconds`.
 *
 * Sampling the final position instead would be a trap: a ball can cross the
 * whole playfield, drain, and be re-served to the plunger inside a couple of
 * seconds, which looks identical to never having left the lane.
 */
function reach(engine: PinballEngine, seconds: number): number {
  let minX = Number.POSITIVE_INFINITY;
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    engine.update(STEP);
    engine.drainEvents();
    minX = Math.min(minX, engine.state.ballPos.x);
  }
  return minX;
}

/** Holds the plunger for `frames`, then releases it. */
function launch(engine: PinballEngine, frames: number): void {
  engine.setPlunger(true);
  for (let i = 0; i < frames; i++) engine.update(STEP);
  engine.setPlunger(false);
}

/**
 * Plays a whole game with no flipper input, charging the plunger fully each
 * time a ball is served.
 */
function autoPlay(engine: PinballEngine, maxSeconds: number): GameEvent[] {
  const events: GameEvent[] = [];
  const steps = Math.round(maxSeconds / STEP);
  let charging = 0;

  for (let i = 0; i < steps; i++) {
    if (engine.state.phase === 'launch') {
      engine.setPlunger(true);
      charging += 1;
      if (charging > 45) {
        engine.setPlunger(false);
        charging = 0;
      }
    }
    engine.update(STEP);
    events.push(...engine.drainEvents());
    if (engine.state.phase === 'over') break;
  }
  return events;
}

describe('PinballEngine', () => {
  it('waits on the menu until a game is started', () => {
    const engine = new PinballEngine();
    expect(engine.state.phase).toBe('ready');
    expect(engine.state.score).toBe(0);
    expect(engine.state.ballNumber).toBe(0);
  });

  it('serves the first ball to the plunger', () => {
    const engine = new PinballEngine();
    engine.startGame();
    expect(engine.state.phase).toBe('launch');
    expect(engine.state.ballNumber).toBe(1);
    expect(engine.state.ballPos.x).toBeGreaterThan(LANE.dividerX);
  });

  it('puts a fully charged launch onto the playfield', () => {
    const engine = new PinballEngine();
    engine.startGame();
    launch(engine, 60);
    expect(engine.state.phase).toBe('play');
    expect(reach(engine, 3)).toBeLessThan(LANE.dividerX);
  });

  // The lane flap is the piece most likely to regress into a ball trap: a weak
  // launch rises above it, falls back onto it, and must roll off into the
  // playfield rather than settling in the pocket above the lane.
  it('does not trap a weak launch above the lane', () => {
    const engine = new PinballEngine();
    engine.startGame();
    launch(engine, 1);
    expect(reach(engine, 6)).toBeLessThan(LANE.dividerX);
  });

  it('keeps the ball inside the table walls', () => {
    const engine = new PinballEngine();
    engine.startGame();
    launch(engine, 60);
    for (let i = 0; i < 60 * 20; i++) {
      engine.update(STEP);
      const { x, y } = engine.state.ballPos;
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(TABLE.width);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThanOrEqual(TABLE.height);
    }
  });

  // Proves the playfield has no geometry that can hold a ball indefinitely:
  // left entirely alone, three balls drain and the game ends.
  it('completes a three-ball game with no input', () => {
    const engine = new PinballEngine();
    engine.startGame();
    const events = autoPlay(engine, 240);

    expect(engine.state.phase).toBe('over');
    expect(engine.state.ballNumber).toBe(3);
    expect(events.filter((e) => e.kind === 'drain')).toHaveLength(3);
    expect(events.some((e) => e.kind === 'gameover')).toBe(true);
  });

  it('scores while the ball crosses the playfield', () => {
    const engine = new PinballEngine();
    engine.startGame();
    const events = autoPlay(engine, 240);
    const scoring = events.filter((e) => typeof e.points === 'number');
    expect(scoring.length).toBeGreaterThan(0);
    expect(engine.state.score).toBeGreaterThan(0);
  });

  /**
   * Reproduces the reported stuck ball exactly.
   *
   * Balanced on a flipper's pivot cap the contact normal points straight up,
   * so gravity has no tangential component to roll the ball off, and the
   * resolver only depenetrates a resting contact — the ball bounces
   * microscopically in place forever. Flipping does not help either: surface
   * velocity scales with distance from the pivot and is nil exactly there.
   *
   * The engine's stuck-escape is what has to break it, including while the
   * player holds the flipper up.
   */
  it.each(FLIPPERS.map((f) => [f.id, f] as const))(
    'frees a ball balanced on the %s flipper pivot',
    (_id, flipper) => {
      for (const held of [false, true]) {
        const engine = new PinballEngine();
        engine.startGame();
        engine.setFlipper(flipper.id, held);
        engine.placeBall({
          x: flipper.pivot.x,
          y: flipper.pivot.y - (BALL_RADIUS + flipper.radius),
        });

        let freedAfter: number | null = null;
        for (let i = 0; i < 60 * 5; i++) {
          engine.update(STEP);
          engine.drainEvents();
          const p = engine.state.ballPos;
          const moved = Math.hypot(
            p.x - flipper.pivot.x,
            p.y - flipper.pivot.y
          );
          if (moved > 60 || engine.state.phase !== 'play') {
            freedAfter = i * STEP;
            break;
          }
        }

        expect(
          freedAfter,
          `ball never left the ${flipper.id} pivot (flipper held: ${held})`
        ).not.toBeNull();
        expect(freedAfter!).toBeLessThan(2);
      }
    }
  );

  it('resets the score when a new game starts', () => {
    const engine = new PinballEngine();
    engine.startGame();
    autoPlay(engine, 240);
    expect(engine.state.phase).toBe('over');

    engine.startGame();
    expect(engine.state.score).toBe(0);
    expect(engine.state.ballNumber).toBe(1);
    expect(engine.state.targetBanksCleared).toBe(0);
  });
});
