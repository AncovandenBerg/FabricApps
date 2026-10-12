import { describe, expect, it } from 'vitest';

import {
  BALL_RADIUS,
  DROP_TARGETS,
  FLIPPERS,
  LIGHTS,
  TABLE,
  WALLS,
} from './table';
import { len, sub } from './vec';

describe('playfield geometry', () => {
  /**
   * The side walls must reach the flipper pivots. An earlier revision ended
   * them short to avoid a resting-ball corner, which opened a gap beside each
   * flipper that the ball simply fell through — far worse than the problem it
   * solved. The resting ball is handled in the engine instead; this keeps the
   * walls closed.
   */
  it('closes the wall into each flipper pivot', () => {
    for (const flipper of FLIPPERS) {
      const nearest = Math.min(
        ...WALLS.flatMap((w) => [
          len(sub(w.a, flipper.pivot)),
          len(sub(w.b, flipper.pivot)),
        ])
      );
      expect(
        nearest,
        `nearest wall end is ${nearest.toFixed(1)} from the ${flipper.id} pivot — a gap the ball can fall through`
      ).toBeLessThanOrEqual(BALL_RADIUS * 2);
    }
  });

  it('leaves a drain gap the ball can actually fit through', () => {
    const [left, right] = FLIPPERS;
    const leftTip = left!.pivot.x + Math.cos(left!.restAngle) * left!.length;
    const rightTip = right!.pivot.x + Math.cos(right!.restAngle) * right!.length;
    const gap = rightTip - leftTip;
    expect(gap).toBeGreaterThan(BALL_RADIUS * 2);
    expect(gap).toBeLessThan(BALL_RADIUS * 6);
  });

  it('places the flippers symmetrically about the playfield centre', () => {
    const [left, right] = FLIPPERS;
    const centre = 207;
    expect(centre - left!.pivot.x).toBeCloseTo(right!.pivot.x - centre, 5);
    expect(left!.pivot.y).toBe(right!.pivot.y);
  });

  it('keeps every object inside the table bounds', () => {
    for (const t of DROP_TARGETS) {
      expect(t.x).toBeGreaterThan(0);
      expect(t.x + t.w).toBeLessThan(TABLE.width);
      expect(t.y + t.h).toBeLessThan(TABLE.drainY);
    }
    for (const l of LIGHTS) {
      expect(l.c.x).toBeGreaterThan(0);
      expect(l.c.x).toBeLessThan(TABLE.width);
      expect(l.c.y).toBeGreaterThan(0);
      expect(l.c.y).toBeLessThan(TABLE.height);
    }
  });
});
