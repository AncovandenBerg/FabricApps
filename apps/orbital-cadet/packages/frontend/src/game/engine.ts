import {
  BALL_RADIUS,
  BUMPERS,
  DROP_TARGETS,
  FLIPPERS,
  LANE,
  TABLE,
  TARGET_BANK_BONUS,
  WALLS,
  type Bumper,
  type DropTarget,
  type FlipperSpec,
  type Wall,
} from './table';
import {
  add,
  closestOnRect,
  closestOnSegment,
  dot,
  fromAngle,
  len,
  norm,
  perp,
  scale,
  sub,
  vec,
  type Vec,
} from './vec';

export type Phase = 'ready' | 'launch' | 'play' | 'drained' | 'over';

export type GameEventKind =
  | 'start'
  | 'launch'
  | 'bumper'
  | 'sling'
  | 'target'
  | 'bank'
  | 'flipper'
  | 'drain'
  | 'gameover';

export interface GameEvent {
  readonly kind: GameEventKind;
  readonly at?: Vec;
  readonly points?: number;
  readonly id?: string;
}

export interface FlipperState {
  angle: number;
  omega: number;
  engaged: boolean;
}

export interface GameState {
  phase: Phase;
  score: number;
  ballNumber: number;
  totalBalls: number;
  /** Plunger charge, 0..1. */
  plunger: number;
  elapsed: number;
  targetBanksCleared: number;
  ballPos: Vec;
  ballVel: Vec;
  trail: Vec[];
  flippers: Record<'left' | 'right', FlipperState>;
  targetsDown: Record<string, boolean>;
  /** Seconds of flash remaining per obstacle, for the renderer. */
  flash: Record<string, number>;
}

/**
 * Gravity is tuned against the lane, not picked for realism. The ball rests at
 * y = 714 and the lane opens onto the arc at roughly y = 188, so clearing it
 * costs sqrt(2 * GRAVITY * 526) ≈ 665 units/s. `PLUNGER_MIN` sits just below
 * that and the range well above, which is what gives the plunger something to
 * decide: a tap drops the ball back to the plunger, a real pull puts it on the
 * arc.
 */
const GRAVITY = 420;
const MAX_SPEED = 1200;
const SUBSTEP = 1 / 240;
const SURFACE_FRICTION = 0.035;
const FLIPPER_SPEED = 17;
const FLIPPER_RESTITUTION = 0.25;
const PLUNGER_CHARGE_RATE = 1.5;
const PLUNGER_MIN = 640;
const PLUNGER_RANGE = 420;
const TRAIL_LENGTH = 14;
const DRAIN_PAUSE = 1.0;
const BANK_RESET_DELAY = 1.2;
const TOTAL_BALLS = 3;

/**
 * How long a near-motionless ball is tolerated before the engine shoves it.
 *
 * Sized against what the player sees, not what the simulation needs: a single
 * shove has to clear the ball well away from where it settled, so a weak one
 * that merely re-settles costs a second wait and reads as a hang. Measured at
 * roughly a second end to end.
 */
const STUCK_SECONDS = 0.8;
const STUCK_ESCAPE_LIFT = 220;

interface CollisionResult {
  pos: Vec;
  vel: Vec;
  /** True only on a real approach, so resting contact cannot score forever. */
  impact: boolean;
}

/**
 * Resolves a ball against one obstacle, given the closest point on that
 * obstacle surface and the separation the two should keep.
 *
 * `surfaceVel` is what makes flippers work: the contact point of a swinging
 * flipper is itself moving, so the bounce is computed in the frame of the
 * moving surface and converted back afterwards. With it at zero this is an
 * ordinary static bounce.
 */
function resolve(
  pos: Vec,
  vel: Vec,
  contact: Vec,
  separation: number,
  restitution: number,
  kick: number,
  surfaceVel: Vec,
  fallbackNormal: Vec
): CollisionResult {
  const d = sub(pos, contact);
  const dist = len(d);
  if (dist >= separation) return { pos, vel, impact: false };

  const n = dist > 1e-6 ? scale(d, 1 / dist) : fallbackNormal;
  const corrected = add(pos, scale(n, separation - dist + 0.01));

  const rel = sub(vel, surfaceVel);
  const vn = dot(rel, n);
  if (vn >= 0) {
    // Already separating. Depenetrate only, so a resting ball does not buzz.
    return { pos: corrected, vel, impact: false };
  }

  let bounced = sub(rel, scale(n, (1 + restitution) * vn));
  const tangential = sub(bounced, scale(n, dot(bounced, n)));
  bounced = sub(bounced, scale(tangential, SURFACE_FRICTION));

  const out = add(add(bounced, surfaceVel), scale(n, kick));
  return { pos: corrected, vel: out, impact: vn < -40 };
}

function flipperTip(spec: FlipperSpec, angle: number): Vec {
  return add(spec.pivot, fromAngle(angle, spec.length));
}

function clampSpeed(v: Vec): Vec {
  const s = len(v);
  return s > MAX_SPEED ? scale(v, MAX_SPEED / s) : v;
}

/**
 * The pinball simulation. Deliberately free of React and of the canvas: it owns
 * state and time, the renderer only reads, and the host drains `events` to
 * drive flashes and score popups.
 */
export class PinballEngine {
  readonly state: GameState;

  private accumulator = 0;
  private drainTimer = 0;
  private bankResetTimer = 0;
  private stuckTimer = 0;
  private plungerHeld = false;
  private events: GameEvent[] = [];

  constructor() {
    this.state = {
      phase: 'ready',
      score: 0,
      ballNumber: 0,
      totalBalls: TOTAL_BALLS,
      plunger: 0,
      elapsed: 0,
      targetBanksCleared: 0,
      ballPos: vec(LANE.centerX, LANE.restY),
      ballVel: vec(0, 0),
      trail: [],
      flippers: {
        left: { angle: FLIPPERS[0]!.restAngle, omega: 0, engaged: false },
        right: { angle: FLIPPERS[1]!.restAngle, omega: 0, engaged: false },
      },
      targetsDown: Object.fromEntries(DROP_TARGETS.map((t) => [t.id, false])),
      flash: {},
    };
  }

  /** Removes and returns the events raised since the last call. */
  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  startGame(): void {
    const s = this.state;
    s.score = 0;
    s.elapsed = 0;
    s.ballNumber = 1;
    s.targetBanksCleared = 0;
    s.targetsDown = Object.fromEntries(DROP_TARGETS.map((t) => [t.id, false]));
    s.flash = {};
    this.bankResetTimer = 0;
    this.loadBall();
    this.events.push({ kind: 'start' });
  }

  /**
   * Drops the ball at an exact position, in play.
   *
   * A test seam, not used by the game. Resting-ball bugs live at specific
   * points on the table — the apex of a flipper pivot, a corner between two
   * walls — and a hands-off simulation will not reliably wander onto them, so
   * asserting they resolve means being able to put the ball there.
   */
  placeBall(pos: Vec, vel: Vec = vec(0, 0)): void {
    const s = this.state;
    s.ballPos = pos;
    s.ballVel = vel;
    s.trail = [];
    s.phase = 'play';
    this.stuckTimer = 0;
    this.accumulator = 0;
  }

  setFlipper(side: 'left' | 'right', engaged: boolean): void {
    const f = this.state.flippers[side];
    if (f.engaged === engaged) return;
    f.engaged = engaged;
    if (engaged && this.state.phase === 'play') {
      this.events.push({ kind: 'flipper', id: side });
    }
  }

  setPlunger(held: boolean): void {
    if (this.state.phase !== 'launch') return;
    if (held) {
      this.plungerHeld = true;
      return;
    }
    if (!this.plungerHeld) return;
    this.plungerHeld = false;
    this.launch();
  }

  /** Advances the simulation by `dt` seconds of wall-clock time. */
  update(dt: number): void {
    const s = this.state;

    for (const key of Object.keys(s.flash)) {
      const next = (s.flash[key] ?? 0) - dt;
      if (next <= 0) delete s.flash[key];
      else s.flash[key] = next;
    }

    if (s.phase === 'launch' && this.plungerHeld) {
      s.plunger = Math.min(1, s.plunger + dt * PLUNGER_CHARGE_RATE);
    }

    if (s.phase === 'drained') {
      this.drainTimer -= dt;
      if (this.drainTimer <= 0) {
        if (s.ballNumber >= TOTAL_BALLS) {
          s.phase = 'over';
          this.events.push({ kind: 'gameover' });
        } else {
          s.ballNumber += 1;
          this.loadBall();
        }
      }
      return;
    }

    if (this.bankResetTimer > 0) {
      this.bankResetTimer -= dt;
      if (this.bankResetTimer <= 0) {
        for (const t of DROP_TARGETS) s.targetsDown[t.id] = false;
      }
    }

    if (s.phase !== 'play' && s.phase !== 'launch') {
      // Keep animating the flippers so the table still responds on the menu.
      this.accumulator = 0;
      this.stepFlippers(Math.min(dt, 0.05));
      return;
    }

    this.accumulator = Math.min(this.accumulator + dt, 0.1);
    while (this.accumulator >= SUBSTEP) {
      this.accumulator -= SUBSTEP;
      this.stepFlippers(SUBSTEP);
      if (s.phase === 'play') {
        s.elapsed += SUBSTEP;
        this.stepBall(SUBSTEP);
      }
    }

    if (s.phase === 'play') {
      s.trail.push(s.ballPos);
      if (s.trail.length > TRAIL_LENGTH) s.trail.shift();
    }
  }

  private launch(): void {
    const s = this.state;
    s.ballVel = vec(0, -(PLUNGER_MIN + s.plunger * PLUNGER_RANGE));
    s.phase = 'play';
    this.events.push({ kind: 'launch' });
    s.plunger = 0;
  }

  private loadBall(): void {
    const s = this.state;
    s.ballPos = vec(LANE.centerX, LANE.restY);
    s.ballVel = vec(0, 0);
    s.trail = [];
    s.plunger = 0;
    s.phase = 'launch';
    this.plungerHeld = false;
    this.stuckTimer = 0;
  }

  private stepFlippers(dt: number): void {
    for (const spec of FLIPPERS) {
      const f = this.state.flippers[spec.id];
      const target = f.engaged ? spec.activeAngle : spec.restAngle;
      const delta = target - f.angle;
      const maxStep = FLIPPER_SPEED * dt;
      const applied =
        Math.abs(delta) <= maxStep ? delta : Math.sign(delta) * maxStep;
      f.angle += applied;
      f.omega = dt > 0 ? applied / dt : 0;
    }
  }

  private stepBall(dt: number): void {
    const s = this.state;

    let vel = add(s.ballVel, vec(0, GRAVITY * dt));
    vel = scale(vel, 1 - 0.1 * dt);
    let pos = add(s.ballPos, scale(vel, dt));

    for (const wall of WALLS) {
      const r = this.collideWall(pos, vel, wall);
      pos = r.pos;
      vel = r.vel;
    }
    for (const bumper of BUMPERS) {
      const r = this.collideBumper(pos, vel, bumper);
      pos = r.pos;
      vel = r.vel;
    }
    for (const target of DROP_TARGETS) {
      if (s.targetsDown[target.id]) continue;
      const r = this.collideTarget(pos, vel, target);
      pos = r.pos;
      vel = r.vel;
    }
    for (const spec of FLIPPERS) {
      const r = this.collideFlipper(pos, vel, spec);
      pos = r.pos;
      vel = r.vel;
    }

    vel = clampSpeed(vel);

    // Last-resort escape from a resting position the ball cannot leave on its
    // own. The geometry is meant to prevent these, but any convex cap has an
    // apex where the contact normal points straight up and gravity has no
    // tangential component to roll the ball off — a flipper pivot being the
    // obvious one — so a backstop is cheaper than trusting the geometry.
    //
    // The shove aims toward the middle of the playfield rather than in a random
    // direction, because a random one is as likely to drain the ball as to
    // return it to play.
    if (len(vel) < 18) {
      this.stuckTimer += dt;
      if (this.stuckTimer > STUCK_SECONDS) {
        const toCentre = pos.x < TABLE.width / 2 ? 1 : -1;
        vel = add(
          vel,
          vec(toCentre * (140 + Math.random() * 60), -STUCK_ESCAPE_LIFT)
        );
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
    }

    s.ballPos = pos;
    s.ballVel = vel;

    // An under-powered launch rolls back to the plunger. Re-arm instead of
    // leaving a motionless ball in the lane with nothing able to reach it: no
    // ball is lost, the player simply launches again.
    if (pos.x > LANE.dividerX && pos.y > LANE.restY - 24 && len(vel) < 90) {
      this.loadBall();
      return;
    }

    if (pos.y > TABLE.drainY) {
      s.phase = 'drained';
      this.drainTimer = DRAIN_PAUSE;
      this.events.push({ kind: 'drain' });
    }
  }

  private collideWall(pos: Vec, vel: Vec, wall: Wall): CollisionResult {
    const fallback = norm(perp(sub(wall.b, wall.a)));
    if (wall.oneWayFromAbove && dot(sub(pos, wall.a), fallback) <= 0) {
      return { pos, vel, impact: false };
    }

    const contact = closestOnSegment(pos, wall.a, wall.b);
    const r = resolve(
      pos,
      vel,
      contact,
      BALL_RADIUS,
      wall.restitution,
      wall.kick ?? 0,
      vec(0, 0),
      fallback
    );
    if (r.impact && wall.score) {
      this.award(wall.score);
      if (wall.id) this.state.flash[wall.id] = 0.16;
      this.events.push({
        kind: 'sling',
        at: contact,
        points: wall.score,
        ...(wall.id ? { id: wall.id } : {}),
      });
    }
    return r;
  }

  private collideBumper(pos: Vec, vel: Vec, bumper: Bumper): CollisionResult {
    const r = resolve(
      pos,
      vel,
      bumper.c,
      BALL_RADIUS + bumper.r,
      bumper.restitution,
      bumper.kick,
      vec(0, 0),
      vec(0, -1)
    );
    if (r.impact) {
      this.award(bumper.score);
      this.state.flash[bumper.id] = 0.18;
      this.events.push({
        kind: 'bumper',
        at: bumper.c,
        points: bumper.score,
        id: bumper.id,
      });
    }
    return r;
  }

  private collideTarget(
    pos: Vec,
    vel: Vec,
    target: DropTarget
  ): CollisionResult {
    const contact = closestOnRect(pos, target.x, target.y, target.w, target.h);
    const r = resolve(
      pos,
      vel,
      contact,
      BALL_RADIUS,
      0.4,
      0,
      vec(0, 0),
      vec(0, -1)
    );
    if (r.impact) {
      this.state.targetsDown[target.id] = true;
      this.award(target.score);
      this.state.flash[target.id] = 0.25;
      this.events.push({
        kind: 'target',
        at: contact,
        points: target.score,
        id: target.id,
      });
      if (DROP_TARGETS.every((t) => this.state.targetsDown[t.id])) {
        this.award(TARGET_BANK_BONUS);
        this.state.targetBanksCleared += 1;
        this.bankResetTimer = BANK_RESET_DELAY;
        this.events.push({ kind: 'bank', points: TARGET_BANK_BONUS });
      }
    }
    return r;
  }

  private collideFlipper(
    pos: Vec,
    vel: Vec,
    spec: FlipperSpec
  ): CollisionResult {
    const f = this.state.flippers[spec.id];
    const tip = flipperTip(spec, f.angle);
    const contact = closestOnSegment(pos, spec.pivot, tip);
    const surfaceVel = scale(perp(sub(contact, spec.pivot)), f.omega);
    return resolve(
      pos,
      vel,
      contact,
      BALL_RADIUS + spec.radius,
      FLIPPER_RESTITUTION,
      0,
      surfaceVel,
      vec(0, -1)
    );
  }

  private award(points: number): void {
    this.state.score += points;
  }
}
