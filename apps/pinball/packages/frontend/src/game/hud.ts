import type { Phase } from './engine';

/**
 * The slice of engine state the interface renders.
 *
 * Kept separate from `GameState` because the engine mutates its own state in
 * place sixty times a second; this is the immutable snapshot that crosses into
 * React, and `sameHud` is what stops a frame that changed nothing from
 * re-rendering the page.
 */
export interface HudState {
  score: number;
  ballNumber: number;
  totalBalls: number;
  phase: Phase;
  plunger: number;
  targetsDown: number;
  banks: number;
}

export const INITIAL_HUD: HudState = {
  score: 0,
  ballNumber: 0,
  totalBalls: 3,
  phase: 'ready',
  plunger: 0,
  targetsDown: 0,
  banks: 0,
};

export function sameHud(a: HudState, b: HudState): boolean {
  return (
    a.score === b.score &&
    a.ballNumber === b.ballNumber &&
    a.phase === b.phase &&
    a.targetsDown === b.targetsDown &&
    a.banks === b.banks &&
    Math.abs(a.plunger - b.plunger) < 0.02
  );
}
