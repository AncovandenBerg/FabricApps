import { BUFFER_HEIGHT, BUFFER_WIDTH } from './render';

/** Space the chrome needs around the playfield, in CSS pixels. */
export const LAYOUT = {
  /** `p-400` on the desktop, top and bottom. */
  pagePadding: 32,
  /** Title bar + menu bar + status bar + the window's own insets. */
  windowChrome: 108,
  /** The high-score window and the gap beside it, on wide screens only. */
  sidebar: 352,
  /** Below this the layout stacks and the sidebar no longer competes. */
  wideBreakpoint: 1024,
  minWidth: 180,
  minHeight: 240,
} as const;

export interface PlayfieldSize {
  readonly w: number;
  readonly h: number;
}

/**
 * Resolves the playfield to whole pixels on both axes.
 *
 * This deliberately does not live in CSS. The obvious markup — `height: 100%`
 * with `width: auto` and an aspect ratio — cannot work, because a percentage
 * height contributes nothing to the parent's intrinsic width: the window sizes
 * itself to its status bar while the canvas derives a width from the viewport,
 * and the table spills out of the window. Resolving both axes up front breaks
 * that circularity.
 */
export function playfieldSize(vw: number, vh: number): PlayfieldSize {
  const wide = vw >= LAYOUT.wideBreakpoint;
  const maxH = Math.max(
    LAYOUT.minHeight,
    vh - LAYOUT.pagePadding - LAYOUT.windowChrome
  );
  const maxW = Math.max(
    LAYOUT.minWidth,
    vw - LAYOUT.pagePadding - (wide ? LAYOUT.sidebar : 0) - 24
  );

  let h = maxH;
  let w = (h * BUFFER_WIDTH) / BUFFER_HEIGHT;
  if (w > maxW) {
    w = maxW;
    h = (w * BUFFER_HEIGHT) / BUFFER_WIDTH;
  }

  return { w: Math.floor(w), h: Math.floor(h) };
}
