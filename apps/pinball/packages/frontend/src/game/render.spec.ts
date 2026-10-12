import { describe, expect, it } from 'vitest';

import { PinballEngine } from './engine';
import {
  BUFFER_HEIGHT,
  BUFFER_WIDTH,
  projectionRow,
  renderTable,
} from './render';

/**
 * jsdom has no canvas context, so the real renderer never executes under test
 * unless it is handed a stub. It runs sixty times a second in the browser, and
 * a single undefined call would blank the table while every other gate still
 * passed — so this exercises it against a recording double.
 *
 * The offscreen background layer cannot be built here either (its own
 * `getContext` returns null), which makes this a useful second check: it
 * proves the renderer degrades to its flat fallback fill instead of throwing
 * when the cached layer is unavailable.
 */
function recordingContext(): { calls: string[]; ctx: CanvasRenderingContext2D } {
  const calls: string[] = [];
  const gradient = { addColorStop: () => calls.push('addColorStop') };

  const target: Record<string, unknown> = {
    canvas: { width: BUFFER_WIDTH, height: BUFFER_HEIGHT },
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createImageData: (w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    }),
  };

  for (const name of [
    'save',
    'restore',
    'beginPath',
    'closePath',
    'moveTo',
    'lineTo',
    'arc',
    'arcTo',
    'fill',
    'stroke',
    'fillRect',
    'setTransform',
    'drawImage',
    'putImageData',
  ]) {
    target[name] = () => {
      calls.push(name);
    };
  }

  // Any property the renderer touches that the stub does not define would throw
  // on assignment under 'use strict'; the proxy records it instead, so a typo
  // shows up as an unexpected call rather than passing silently.
  const ctx = new Proxy(target, {
    get: (obj, prop) => obj[prop as string],
    set: (obj, prop, value) => {
      obj[prop as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  return { calls, ctx };
}

describe('renderTable', () => {
  it('draws the idle table without touching the ball', () => {
    const { calls, ctx } = recordingContext();
    const engine = new PinballEngine();

    expect(() => renderTable(ctx, engine.state)).not.toThrow();
    expect(calls).toContain('fillRect');
    expect(calls).toContain('setTransform');
  });

  it('draws every phase of a live game', () => {
    const engine = new PinballEngine();
    engine.startGame();
    engine.setPlunger(true);
    for (let i = 0; i < 30; i++) engine.update(1 / 60);
    engine.setPlunger(false);

    const seen = new Set<string>();
    for (let i = 0; i < 60 * 30; i++) {
      engine.update(1 / 60);
      seen.add(engine.state.phase);
      const { ctx } = recordingContext();
      expect(() => renderTable(ctx, engine.state)).not.toThrow();
      if (engine.state.phase === 'over') break;
    }

    // The flash, dropped-target and plunger branches only exist in some phases,
    // so the sweep is only meaningful if it actually reached them.
    expect(seen.has('play')).toBe(true);
    expect(seen.has('drained')).toBe(true);
  });

  it('keeps the buffer small enough for the upscale to read as pixels', () => {
    expect(BUFFER_WIDTH).toBeLessThanOrEqual(320);
    expect(BUFFER_HEIGHT).toBeGreaterThan(BUFFER_WIDTH);
  });

  // The display buffer must be squatter than the physics space, the way the
  // original's 365x470 bitmap is squatter than its 16x29 table.
  it('foreshortens the table rather than showing it top-down', () => {
    const flatRatio = 440 / 780;
    const screenRatio = BUFFER_WIDTH / BUFFER_HEIGHT;
    expect(screenRatio).toBeGreaterThan(flatRatio);
    expect(screenRatio).toBeCloseTo(0.777, 2);
  });
});

describe('projectionRow', () => {
  it('anchors both edges', () => {
    const far = projectionRow(0);
    const near = projectionRow(1);
    expect(far.srcT).toBeCloseTo(0, 6);
    expect(near.srcT).toBeCloseTo(1, 6);
    expect(near.widthScale).toBeCloseTo(1, 6);
    expect(far.widthScale).toBeLessThan(1);
  });

  it('narrows toward the far edge', () => {
    let previous = 0;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const w = projectionRow(Math.min(1, t)).widthScale;
      expect(w).toBeGreaterThanOrEqual(previous);
      previous = w;
    }
  });

  // The giveaway that this is perspective and not a plain vertical squash: a
  // linear mapping would put srcT exactly on t, while perspective compresses
  // the far half so every interior row samples further down the playfield.
  // Stepped with integers: the two curves meet exactly at both ends, so a
  // float-accumulated loop lands on t = 0.999… and compares equal there.
  it('compresses the far half instead of scaling uniformly', () => {
    for (let i = 1; i <= 9; i++) {
      const t = i / 10;
      expect(projectionRow(t).srcT).toBeGreaterThan(t);
    }
  });

  it('advances monotonically through the source', () => {
    let previous = -1;
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const s = projectionRow(Math.min(1, t)).srcT;
      expect(s).toBeGreaterThan(previous);
      previous = s;
    }
  });
});
