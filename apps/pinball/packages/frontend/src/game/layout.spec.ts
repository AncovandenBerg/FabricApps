import { describe, expect, it } from 'vitest';

import { LAYOUT, playfieldSize } from './layout';
import { BUFFER_HEIGHT, BUFFER_WIDTH } from './render';

const RATIO = BUFFER_WIDTH / BUFFER_HEIGHT;

/** Common desktop and laptop viewports, plus a phone and a short window. */
const VIEWPORTS: readonly [number, number, string][] = [
  [1920, 1080, 'desktop'],
  [1680, 1050, 'large laptop'],
  [1440, 900, 'laptop'],
  [1366, 768, 'small laptop'],
  [1024, 768, 'breakpoint'],
  [1280, 600, 'short window'],
  [390, 844, 'phone'],
];

describe('playfieldSize', () => {
  it.each(VIEWPORTS)('keeps the table ratio at %ix%i (%s)', (vw, vh) => {
    const { w, h } = playfieldSize(vw, vh);
    expect(w / h).toBeCloseTo(RATIO, 1);
  });

  // The bug this guards: the table overflowed its window and painted across
  // the desktop and the high-score window beside it.
  it.each(VIEWPORTS)(
    'fits beside the sidebar at %ix%i (%s)',
    (vw, vh) => {
      const { w } = playfieldSize(vw, vh);
      const sidebar = vw >= LAYOUT.wideBreakpoint ? LAYOUT.sidebar : 0;
      expect(w).toBeLessThanOrEqual(vw - sidebar - LAYOUT.pagePadding);
    }
  );

  it.each(VIEWPORTS)('fits the viewport height at %ix%i (%s)', (vw, vh) => {
    const { h } = playfieldSize(vw, vh);
    expect(h + LAYOUT.windowChrome + LAYOUT.pagePadding).toBeLessThanOrEqual(
      Math.max(vh, LAYOUT.minHeight + LAYOUT.windowChrome + LAYOUT.pagePadding)
    );
  });

  it('prefers height, and only falls back to width when it must', () => {
    // Tall and narrow: width is the binding constraint.
    const narrow = playfieldSize(1100, 1400);
    expect(narrow.w).toBe(1100 - LAYOUT.pagePadding - LAYOUT.sidebar - 24);

    // Short and wide: height binds instead.
    const short = playfieldSize(2400, 700);
    expect(short.h).toBe(700 - LAYOUT.pagePadding - LAYOUT.windowChrome);
  });

  // Needs a viewport tall enough that width is the binding constraint —
  // otherwise height caps both sides and the sidebar makes no difference.
  it('drops the sidebar reservation below the breakpoint', () => {
    const wide = playfieldSize(LAYOUT.wideBreakpoint, 1600);
    const stacked = playfieldSize(LAYOUT.wideBreakpoint - 1, 1600);
    expect(stacked.w).toBeGreaterThan(wide.w);
    expect(wide.w).toBe(
      LAYOUT.wideBreakpoint - LAYOUT.pagePadding - LAYOUT.sidebar - 24
    );
  });

  it('always returns whole positive pixels', () => {
    for (const [vw, vh] of VIEWPORTS) {
      const { w, h } = playfieldSize(vw, vh);
      expect(Number.isInteger(w)).toBe(true);
      expect(Number.isInteger(h)).toBe(true);
      expect(w).toBeGreaterThan(0);
      expect(h).toBeGreaterThan(0);
    }
  });
});
