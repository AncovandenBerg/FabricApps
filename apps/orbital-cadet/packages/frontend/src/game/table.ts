import { vec, type Vec } from './vec';

/**
 * Playfield geometry, in table units. The renderer scales these to pixels, so
 * nothing here depends on canvas size or device pixel ratio.
 *
 * Layout, top to bottom: a launch lane down the right-hand side feeding a wide
 * arc across the top; three pop bumpers below the arc; a bank of three drop
 * targets across the middle; two posts; two slingshots; two flippers over the
 * drain. The playfield is symmetric about x = 207 — the arc is not, because the
 * launch lane pushes it right.
 */
export const TABLE = {
  width: 440,
  height: 780,
  /** Below this, the ball is lost. */
  drainY: 742,
} as const;

export const BALL_RADIUS = 9;

/** Launch lane: a channel between the divider and the outer wall. */
export const LANE = {
  dividerX: 400,
  outerX: 426,
  floorY: 726,
  /** Where the ball sits waiting for the plunger. */
  restY: 714,
  get centerX() {
    return (this.dividerX + this.outerX) / 2;
  },
} as const;

const ARC = { cx: 220, cy: 258, r: 206 } as const;

export interface Wall {
  readonly a: Vec;
  readonly b: Vec;
  readonly restitution: number;
  /** Extra impulse along the surface normal — slingshots only. */
  readonly kick?: number;
  readonly score?: number;
  readonly id?: string;
  /**
   * A one-way flap: solid to a ball approaching from the upper side, open to
   * one arriving from below. Tested by which side of the segment the ball is
   * on rather than by its velocity, so a ball resting on the flap cannot leak
   * through it between bounces.
   */
  readonly oneWayFromAbove?: boolean;
}

export interface Bumper {
  readonly id: string;
  readonly c: Vec;
  readonly r: number;
  readonly restitution: number;
  readonly kick: number;
  readonly score: number;
  readonly kind: 'bumper' | 'post';
}

export interface DropTarget {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly score: number;
}

export interface FlipperSpec {
  readonly id: 'left' | 'right';
  readonly pivot: Vec;
  readonly length: number;
  readonly radius: number;
  /** Radians. Screen space, so positive angles point downward. */
  readonly restAngle: number;
  readonly activeAngle: number;
}

const deg = (d: number): number => (d * Math.PI) / 180;

/** The top arc, as a polyline from the left wall over to the lane's outer wall. */
function arcWalls(segments = 40): Wall[] {
  const points: Vec[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = deg(180 + (180 * i) / segments);
    points.push(vec(ARC.cx + Math.cos(t) * ARC.r, ARC.cy + Math.sin(t) * ARC.r));
  }
  const walls: Wall[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    walls.push({ a: points[i]!, b: points[i + 1]!, restitution: 0.42 });
  }
  return walls;
}

export const WALLS: readonly Wall[] = [
  ...arcWalls(),

  // Left side. The lower slope runs all the way onto the flipper pivot, so a
  // ball tracking the wall is delivered onto the flipper rather than dropping
  // through a gap beside it into the drain.
  //
  // A ball can balance on the pivot cap this creates — the contact normal
  // there points straight up, so gravity has no tangential component to roll
  // it off, and a flipper cannot throw it clear because surface velocity
  // scales with distance from the pivot and is nil exactly there. That is
  // handled in the engine's stuck-escape rather than by opening a gap here:
  // the gap cost far more playability than the rare balance did.
  { a: vec(14, 258), b: vec(14, 620), restitution: 0.42 },
  { a: vec(14, 620), b: vec(120, 650), restitution: 0.38 },

  // Upper-left deflector. Without it the arc throws a launched ball straight
  // down the left wall, past every scoring object, into the drain — a
  // guaranteed dead ball. This catches that descent and turns it back toward
  // the post and the slingshot.
  { a: vec(14, 380), b: vec(62, 420), restitution: 0.45 },

  // The lane divider doubles as the playfield's right wall. Its top meets the
  // low end of the flap below, so a ball rolling off the flap is nudged left
  // into the playfield by this wall's end cap.
  { a: vec(400, 286), b: vec(400, 726), restitution: 0.42 },
  // Mirrored about x = 207.
  { a: vec(400, 620), b: vec(294, 650), restitution: 0.38 },

  // Right deflector, mirrored about x = 207.
  { a: vec(400, 380), b: vec(352, 420), restitution: 0.45 },

  // Launch lane: outer wall and floor.
  { a: vec(426, 258), b: vec(426, 726), restitution: 0.3 },
  { a: vec(400, 726), b: vec(426, 726), restitution: 0.2 },

  // One-way flap across the top of the lane, sloped down toward the playfield.
  // A launched ball passes up through it; anything coming back down lands on
  // it and rolls off the left end into the playfield rather than dropping back
  // into the lane. The slope is what makes a weak launch playable instead of
  // trapped: it simply enters the table at the top right.
  {
    a: vec(426, 262),
    b: vec(400, 286),
    restitution: 0.25,
    oneWayFromAbove: true,
  },

  // Left slingshot — the a→b face is the live one.
  {
    id: 'sling-left',
    a: vec(50, 520),
    b: vec(126, 604),
    restitution: 0.5,
    kick: 430,
    score: 50,
  },
  { a: vec(126, 604), b: vec(50, 604), restitution: 0.3 },
  { a: vec(50, 604), b: vec(50, 520), restitution: 0.3 },

  // Right slingshot, mirrored about x = 207.
  {
    id: 'sling-right',
    a: vec(364, 520),
    b: vec(288, 604),
    restitution: 0.5,
    kick: 430,
    score: 50,
  },
  { a: vec(288, 604), b: vec(364, 604), restitution: 0.3 },
  { a: vec(364, 604), b: vec(364, 520), restitution: 0.3 },
];

export const BUMPERS: readonly Bumper[] = [
  {
    id: 'bumper-left',
    c: vec(140, 300),
    r: 24,
    restitution: 0.5,
    kick: 430,
    score: 100,
    kind: 'bumper',
  },
  {
    id: 'bumper-top',
    c: vec(218, 250),
    r: 24,
    restitution: 0.5,
    kick: 430,
    score: 100,
    kind: 'bumper',
  },
  {
    id: 'bumper-right',
    c: vec(296, 300),
    r: 24,
    restitution: 0.5,
    kick: 430,
    score: 100,
    kind: 'bumper',
  },
  {
    id: 'post-left',
    c: vec(66, 440),
    r: 11,
    restitution: 0.55,
    kick: 0,
    score: 10,
    kind: 'post',
  },
  {
    id: 'post-right',
    c: vec(348, 440),
    r: 11,
    restitution: 0.55,
    kick: 0,
    score: 10,
    kind: 'post',
  },
];

export const DROP_TARGETS: readonly DropTarget[] = [
  { id: 'target-a', x: 124, y: 372, w: 38, h: 13, score: 500 },
  { id: 'target-b', x: 201, y: 372, w: 38, h: 13, score: 500 },
  { id: 'target-c', x: 278, y: 372, w: 38, h: 13, score: 500 },
];

/** Awarded for dropping all three targets; the bank then resets. */
export const TARGET_BANK_BONUS = 5000;

export const FLIPPERS: readonly FlipperSpec[] = [
  {
    id: 'left',
    pivot: vec(120, 648),
    length: 76,
    radius: 8,
    restAngle: deg(28),
    activeAngle: deg(-30),
  },
  {
    id: 'right',
    pivot: vec(294, 648),
    length: 76,
    radius: 8,
    restAngle: deg(152),
    activeAngle: deg(210),
  },
];

/**
 * A playfield lamp.
 *
 * The original Space Cadet table carries 134 individually addressable lights,
 * grouped into named banks that blink in programmed sequences. That — not the
 * painted artwork — is what gives the table its character: it reads as a dark
 * board covered in lamps rather than as a picture. These are generated from the
 * geometry rather than hand-placed so they stay attached to the rails if the
 * table is ever retuned.
 */
export interface Light {
  readonly id: string;
  readonly c: Vec;
  readonly r: number;
  readonly group: 'rail' | 'bumper' | 'target' | 'sling' | 'lane';
  /** Position within its bank, so a group can be chased in order. */
  readonly seq: number;
  /** The object whose state drives this lamp, where one does. */
  readonly owner?: string;
}

/** A point on the top arc, inset toward the playfield by `inset`. */
function arcPoint(degrees: number, inset: number): Vec {
  const t = deg(degrees);
  return vec(
    ARC.cx + Math.cos(t) * (ARC.r - inset),
    ARC.cy + Math.sin(t) * (ARC.r - inset)
  );
}

function buildLights(): Light[] {
  const lights: Light[] = [];
  let seq = 0;

  // A necklace of lamps following the top arc, the dominant feature of the
  // upper playfield.
  for (let a = 186; a <= 354; a += 10.5) {
    lights.push({
      id: `rail-arc-${seq}`,
      c: arcPoint(a, 17),
      r: 3,
      group: 'rail',
      seq: seq++,
    });
  }

  // Down both side walls, continuing the same chase.
  for (let y = 320; y <= 600; y += 56) {
    lights.push({
      id: `rail-left-${y}`,
      c: vec(27, y),
      r: 3,
      group: 'rail',
      seq: seq++,
    });
  }
  for (let y = 600; y >= 330; y -= 56) {
    lights.push({
      id: `rail-right-${y}`,
      c: vec(387, y),
      r: 3,
      group: 'rail',
      seq: seq++,
    });
  }

  // A ring of three around each pop bumper, which light on impact.
  for (const b of BUMPERS) {
    if (b.kind !== 'bumper') continue;
    [90, 210, 330].forEach((a, i) => {
      const t = deg(a);
      lights.push({
        id: `bumper-${b.id}-${i}`,
        c: vec(
          b.c.x + Math.cos(t) * (b.r + 9),
          b.c.y + Math.sin(t) * (b.r + 9)
        ),
        r: 2.5,
        group: 'bumper',
        seq: i,
        owner: b.id,
      });
    });
  }

  // One lamp above each drop target: lit while the target still stands.
  DROP_TARGETS.forEach((t, i) => {
    lights.push({
      id: `target-${t.id}`,
      c: vec(t.x + t.w / 2, t.y - 12),
      r: 3,
      group: 'target',
      seq: i,
      owner: t.id,
    });
  });

  // Slingshot indicators.
  lights.push(
    {
      id: 'sling-l',
      c: vec(74, 556),
      r: 2.5,
      group: 'sling',
      seq: 0,
      owner: 'sling-left',
    },
    {
      id: 'sling-r',
      c: vec(340, 556),
      r: 2.5,
      group: 'sling',
      seq: 1,
      owner: 'sling-right',
    }
  );

  // Skill-shot lamps down the launch lane.
  [360, 420, 480].forEach((y, i) => {
    lights.push({
      id: `lane-${i}`,
      c: vec(LANE.centerX, y),
      r: 2.5,
      group: 'lane',
      seq: i,
    });
  });

  return lights;
}

export const LIGHTS: readonly Light[] = buildLights();

/** How many lamps are in the longest chase, so the renderer can normalise it. */
export const RAIL_LIGHT_COUNT = LIGHTS.filter((l) => l.group === 'rail').length;
