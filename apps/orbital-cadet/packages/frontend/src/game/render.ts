import type { GameState } from './engine';
import {
  BALL_RADIUS,
  BUMPERS,
  DROP_TARGETS,
  FLIPPERS,
  LANE,
  LIGHTS,
  RAIL_LIGHT_COUNT,
  TABLE,
  WALLS,
  type Light,
} from './table';
import { add, fromAngle, type Vec } from './vec';

/**
 * Two buffers, because the original is not drawn top-down.
 *
 * Space Cadet renders its table through a camera tilted about 24°: the
 * decompiled `camera_info` matrix carries `acos(0.913545) ≈ 24°`, and that is
 * why its physics space (16 × 29 world units, ratio 0.552) reaches the screen
 * as a 365 × 470 bitmap (ratio 0.777) — markedly squatter. A straight
 * top-down render is the single most un-period thing a pinball table can do.
 *
 * So the scene is drawn flat, then projected: `FLAT` is the top-down playfield
 * in table proportions, `BUFFER` is what the player sees after foreshortening.
 */
const FLAT_WIDTH = 240;
const FLAT_HEIGHT = Math.round((FLAT_WIDTH * TABLE.height) / TABLE.width);
const SCALE = FLAT_WIDTH / TABLE.width;

export const BUFFER_WIDTH = 240;
/** 0.777 is the original's own screen ratio, taken from its table bitmap. */
export const BUFFER_HEIGHT = Math.round(BUFFER_WIDTH / 0.777);

/**
 * Horizontal scale at the far (top) edge. Under perspective the back of the
 * table is further away and therefore narrower; 1/z is linear in screen space,
 * which is what makes the scanline mapping below exact rather than eyeballed.
 */
const FAR_SCALE = 0.8;
/** Scanline band height. Two keeps the stepping visible and the cost down. */
const BAND = 2;

/**
 * A fixed VGA-era palette: flat fills and hard edges, no gradients and no
 * blur. Shading steps between adjacent ramp entries, the way a 256-colour game
 * would, rather than compositing translucent layers.
 */
const C = {
  space: ['#1b1b52', '#161644', '#101036', '#0a0a28', '#05051a', '#01010e'],
  star: '#7878b8',
  starBright: '#d8d8ff',
  lane: '#00000c',
  drain: '#3a0018',
  railLight: '#d8d8f0',
  rail: '#7878a8',
  railDark: '#3c3c5c',
  bumper: '#ff8000',
  bumperLit: '#ffe070',
  bumperEdge: '#ffffff',
  post: '#9c9cc0',
  postEdge: '#d8d8f0',
  target: '#d00000',
  targetLit: '#ff9090',
  targetDown: '#3c1020',
  sling: '#d0d000',
  slingLit: '#ffffa8',
  flipper: '#dcdce4',
  flipperEdge: '#6c6c88',
  ball: '#b4b4c8',
  ballLight: '#ffffff',
  ballDark: '#54546c',
  plunger: '#ff8000',
  plungerIdle: '#5c5c78',
} as const;

/** Lamp colours: [unlit, lit]. */
const LAMP: Record<Light['group'], readonly [string, string]> = {
  rail: ['#2e2e5c', '#ffd040'],
  bumper: ['#4a2a10', '#ffffff'],
  target: ['#4a1020', '#ff4040'],
  sling: ['#4a4a10', '#ffff80'],
  lane: ['#10303a', '#40ffd0'],
};

/** Ordered 4×4 Bayer matrix — the classic VGA dither. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

let background: HTMLCanvasElement | null | undefined;
let flat: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null | undefined;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function makeCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/**
 * Paints the vertical space ramp with an ordered dither, so the bands break up
 * into stipple the way a 256-colour gradient did rather than into the smooth
 * blend a modern canvas gradient would give.
 */
function paintDitheredSky(ctx: CanvasRenderingContext2D): void {
  const { width: w, height: h } = ctx.canvas;
  const image = ctx.createImageData(w, h);
  const ramp = C.space.map(hexToRgb);
  const top = ramp.length - 1;

  for (let y = 0; y < h; y++) {
    const level = (y / (h - 1)) * top;
    const base = Math.floor(level);
    const frac = level - base;
    for (let x = 0; x < w; x++) {
      const threshold = BAYER[(y % 4) * 4 + (x % 4)]! / 16;
      const index = Math.min(top, base + (frac > threshold ? 1 : 0));
      const [r, g, b] = ramp[index]!;
      const o = (y * w + x) * 4;
      image.data[o] = r;
      image.data[o + 1] = g;
      image.data[o + 2] = b;
      image.data[o + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

/** Single-pixel stars, deterministic so the field cannot shimmer. */
function paintStars(ctx: CanvasRenderingContext2D): void {
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rand() * ctx.canvas.width);
    const y = Math.floor(rand() * ctx.canvas.height);
    ctx.fillStyle = rand() > 0.78 ? C.starBright : C.star;
    ctx.fillRect(x, y, 1, 1);
  }
}

function strokeSegment(
  ctx: CanvasRenderingContext2D,
  a: Vec,
  b: Vec,
  color: string,
  width: number
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function dot(
  ctx: CanvasRenderingContext2D,
  c: Vec,
  r: number,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Everything that never changes, drawn once. Caching it is what makes the
 * per-pixel dither affordable: one pass at startup instead of 100,000 pixel
 * writes every frame.
 */
function buildBackground(): HTMLCanvasElement | null {
  const canvas = makeCanvas(FLAT_WIDTH, FLAT_HEIGHT);
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return null;

  paintDitheredSky(ctx);
  paintStars(ctx);

  ctx.save();
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  ctx.fillStyle = C.lane;
  ctx.fillRect(
    LANE.dividerX,
    286,
    LANE.outerX - LANE.dividerX,
    LANE.floorY - 286
  );

  // The drain mouth, as three stepped bands rather than one slab: a flat block
  // of red reads as a painted rectangle, while banding it suggests depth with
  // the same two colours a 256-colour table would have spent on it.
  const drainBands: readonly [number, number, string][] = [
    [698, 14, '#1e0410'],
    [712, 14, '#2c0a16'],
    [726, TABLE.drainY - 726, '#3a0018'],
  ];
  for (const [y, h, color] of drainBands) {
    const inset = (y - 698) * 0.8;
    ctx.fillStyle = color;
    ctx.fillRect(112 + inset, y, 186 - inset * 2, h);
  }

  for (const wall of WALLS) {
    if (wall.kick) continue;
    strokeSegment(ctx, wall.a, wall.b, C.railDark, 5);
    strokeSegment(ctx, wall.a, wall.b, C.rail, 3);
    strokeSegment(ctx, wall.a, wall.b, C.railLight, 1);
  }

  ctx.restore();
  return canvas;
}

/**
 * Lamp brightness, 0..1.
 *
 * Deliberately derived from game state and the clock rather than stored in the
 * engine: the lights are presentation, and keeping them out of the simulation
 * means the physics tests stay a test of physics.
 */
function lampLevel(l: Light, state: GameState, time: number): number {
  const attract = state.phase === 'ready' || state.phase === 'over';

  switch (l.group) {
    case 'rail': {
      // A chase running around the arc and down both walls.
      const speed = attract ? 5 : 2.2;
      const wave = Math.sin(time * speed - (l.seq / RAIL_LIGHT_COUNT) * 12);
      return 0.25 + 0.75 * Math.pow((wave + 1) / 2, 3);
    }
    case 'bumper': {
      const hit = (state.flash[l.owner ?? ''] ?? 0) > 0;
      if (hit) return 1;
      return 0.3 + 0.2 * Math.sin(time * 3 + l.seq * 2);
    }
    case 'target': {
      const down = state.targetsDown[l.owner ?? ''] === true;
      const hit = (state.flash[l.owner ?? ''] ?? 0) > 0;
      if (hit) return 1;
      return down ? 0.12 : 0.85;
    }
    case 'sling':
      return (state.flash[l.owner ?? ''] ?? 0) > 0 ? 1 : 0.3;
    case 'lane': {
      if (state.phase !== 'launch') return 0.2;
      const wave = Math.sin(time * 6 - l.seq * 1.4);
      return 0.25 + 0.75 * Math.max(0, wave);
    }
    default:
      return 0.3;
  }
}

function drawLights(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  time: number
): void {
  for (const l of LIGHTS) {
    const level = lampLevel(l, state, time);
    const [off, on] = LAMP[l.group];
    // Two-state lamps, not a smooth fade: a 256-colour game had a lit frame
    // and an unlit frame, and the hard switch is part of the look.
    dot(ctx, l.c, l.r, level > 0.55 ? on : off);
    if (level > 0.85) dot(ctx, l.c, Math.max(1, l.r - 1.5), '#ffffff');
  }
}

function drawSlingshots(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const wall of WALLS) {
    if (!wall.kick) continue;
    const lit = (state.flash[wall.id ?? ''] ?? 0) > 0;
    strokeSegment(ctx, wall.a, wall.b, C.railDark, 6);
    strokeSegment(ctx, wall.a, wall.b, lit ? C.slingLit : C.sling, 4);
  }
}

function drawTargets(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const t of DROP_TARGETS) {
    if (state.targetsDown[t.id] === true) {
      ctx.fillStyle = C.targetDown;
      ctx.fillRect(t.x, t.y + t.h - 4, t.w, 4);
      continue;
    }
    const lit = (state.flash[t.id] ?? 0) > 0;
    ctx.fillStyle = lit ? C.targetLit : C.target;
    ctx.fillRect(t.x, t.y, t.w, t.h);
    ctx.fillStyle = C.railLight;
    ctx.fillRect(t.x, t.y, t.w, 2);
    ctx.fillStyle = C.railDark;
    ctx.fillRect(t.x, t.y + t.h - 2, t.w, 2);
  }
}

function drawBumpers(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const b of BUMPERS) {
    const lit = (state.flash[b.id] ?? 0) > 0;

    if (b.kind === 'post') {
      dot(ctx, b.c, b.r, C.post);
      dot(
        ctx,
        { x: b.c.x - b.r * 0.25, y: b.c.y - b.r * 0.25 },
        b.r * 0.4,
        C.postEdge
      );
      continue;
    }

    // Concentric flat rings instead of a radial gradient.
    dot(ctx, b.c, b.r + 3, lit ? C.bumperEdge : C.railDark);
    dot(ctx, b.c, b.r, lit ? C.bumperLit : C.bumper);
    dot(ctx, b.c, b.r * 0.45, lit ? C.bumperEdge : C.bumperLit);
  }
}

function drawFlippers(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.lineCap = 'round';
  for (const spec of FLIPPERS) {
    const f = state.flippers[spec.id];
    const tip = add(spec.pivot, fromAngle(f.angle, spec.length));
    strokeSegment(ctx, spec.pivot, tip, C.flipperEdge, spec.radius * 2 + 3);
    strokeSegment(ctx, spec.pivot, tip, C.flipper, spec.radius * 2 - 1);
  }
  ctx.lineCap = 'butt';
}

function drawPlunger(ctx: CanvasRenderingContext2D, state: GameState): void {
  const x = LANE.dividerX + 4;
  const w = LANE.outerX - LANE.dividerX - 8;
  const maxH = 54;
  const h = 10 + state.plunger * maxH;

  ctx.fillStyle = C.railDark;
  ctx.fillRect(x, LANE.floorY - maxH - 10, w, maxH + 10);
  ctx.fillStyle = state.plunger > 0.01 ? C.plunger : C.plungerIdle;
  ctx.fillRect(x, LANE.floorY - h, w, h);
}

function drawBall(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { x, y } = state.ballPos;
  dot(ctx, { x, y }, BALL_RADIUS, C.ballDark);
  dot(
    ctx,
    { x: x - BALL_RADIUS * 0.12, y: y - BALL_RADIUS * 0.12 },
    BALL_RADIUS * 0.82,
    C.ball
  );
  dot(
    ctx,
    { x: x - BALL_RADIUS * 0.34, y: y - BALL_RADIUS * 0.34 },
    BALL_RADIUS * 0.3,
    C.ballLight
  );
}

/** The top-down playfield, before any camera. */
function drawFlatScene(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  time: number
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (background === undefined) background = buildBackground();
  if (background) {
    ctx.drawImage(background, 0, 0);
  } else {
    ctx.fillStyle = C.space[C.space.length - 1]!;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  drawSlingshots(ctx, state);
  drawTargets(ctx, state);
  drawBumpers(ctx, state);
  drawLights(ctx, state, time);
  drawPlunger(ctx, state);
  drawFlippers(ctx, state);
  if (state.phase !== 'ready' && state.phase !== 'over') drawBall(ctx, state);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/**
 * Projects the flat playfield under a tilted camera, one scanline band at a
 * time — the period-correct way to fake perspective without a 3D pipeline.
 *
 * For a plane under perspective both `1/z` and `u/z` vary linearly in screen
 * space, so the source row for a destination row is `t / (far + (1-far)·t)`
 * and the row's width is simply `1/z`. That makes this an actual projection
 * rather than a vertical squash: the top of the table is both shorter and
 * narrower, which is what gives the real game its depth.
 */
export interface ProjectedRow {
  /** Where this screen row samples the flat playfield, 0 (far) to 1 (near). */
  readonly srcT: number;
  /** Row width as a fraction of the buffer, 1 at the near edge. */
  readonly widthScale: number;
}

/**
 * The projection, isolated as a pure function so it can be checked without a
 * canvas. `t` runs 0 at the top of the screen (far) to 1 at the bottom (near).
 */
export function projectionRow(t: number): ProjectedRow {
  const invZ = FAR_SCALE + (1 - FAR_SCALE) * t;
  return { srcT: t / invZ, widthScale: invZ };
}

function project(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement): void {
  const H = BUFFER_HEIGHT;
  const srcY = (t: number) => projectionRow(t).srcT * (FLAT_HEIGHT - 1);

  for (let y = 0; y < H; y += BAND) {
    const t0 = y / (H - 1);
    const t1 = Math.min(1, (y + BAND) / (H - 1));
    const sy0 = srcY(t0);
    const sh = Math.max(1, srcY(t1) - sy0);

    const w = BUFFER_WIDTH * projectionRow(t0).widthScale;
    ctx.drawImage(
      src,
      0,
      sy0,
      FLAT_WIDTH,
      sh,
      (BUFFER_WIDTH - w) / 2,
      y,
      w,
      BAND
    );
  }
}

/**
 * Draws one frame into the display buffer. The caller supplies a canvas sized
 * to `BUFFER_WIDTH` × `BUFFER_HEIGHT`.
 */
export function renderTable(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  time = 0
): void {
  if (flat === undefined) {
    const canvas = makeCanvas(FLAT_WIDTH, FLAT_HEIGHT);
    const flatCtx = canvas?.getContext('2d');
    flat = canvas && flatCtx ? { canvas, ctx: flatCtx } : null;
  }

  // Without an offscreen buffer there is nothing to project from, so fall back
  // to the unprojected scene rather than rendering nothing.
  if (!flat) {
    drawFlatScene(ctx, state, time);
    return;
  }

  drawFlatScene(flat.ctx, state, time);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, BUFFER_WIDTH, BUFFER_HEIGHT);
  project(ctx, flat.canvas);
}
