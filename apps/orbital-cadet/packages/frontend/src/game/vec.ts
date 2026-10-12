/** Minimal 2D vector helpers. Values are plain objects and never mutated. */
export interface Vec {
  readonly x: number;
  readonly y: number;
}

export const vec = (x: number, y: number): Vec => ({ x, y });

export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });

export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });

export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });

export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;

export const lenSq = (a: Vec): number => a.x * a.x + a.y * a.y;

export const len = (a: Vec): number => Math.hypot(a.x, a.y);

/** Rotates by +90°. In screen space (y down) this is the clockwise normal. */
export const perp = (a: Vec): Vec => ({ x: -a.y, y: a.x });

export function norm(a: Vec): Vec {
  const l = Math.hypot(a.x, a.y);
  return l > 1e-9 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
}

export const fromAngle = (radians: number, length = 1): Vec => ({
  x: Math.cos(radians) * length,
  y: Math.sin(radians) * length,
});

/** Closest point to `p` on the segment `a`→`b`. */
export function closestOnSegment(p: Vec, a: Vec, b: Vec): Vec {
  const ab = sub(b, a);
  const l2 = lenSq(ab);
  if (l2 < 1e-9) return a;
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return { x: a.x + ab.x * t, y: a.y + ab.y * t };
}

/** Closest point to `p` on the axis-aligned rectangle. */
export function closestOnRect(
  p: Vec,
  x: number,
  y: number,
  w: number,
  h: number
): Vec {
  return {
    x: Math.max(x, Math.min(x + w, p.x)),
    y: Math.max(y, Math.min(y + h, p.y)),
  };
}
