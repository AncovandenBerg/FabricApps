// The week map from the mockups: a winding path of incident nodes. Done
// nodes show a check, the current one pulses with an OPEN badge, upcoming
// ones are locked. Node order is real game state: played attempts, then
// the current scenario, then chained follow-ups and the remaining queue.
import { DomainDot, IconCheck, IconLock, IconPlay } from '@/components/bits';
import { weekConfig } from '@/game/campaign';
import type { GameState } from '@/game/engine';
import type { GameScenario } from '@/game/types';

interface WeekMapProps {
  game: GameState;
  scenarios: GameScenario[];
  onOpen: () => void;
}

interface MapNode {
  key: string;
  title: string;
  domain: string;
  state: 'done' | 'current' | 'locked';
  correct?: boolean;
}

const NODE = 62;
const CURRENT = 68;
const STEP = 100;
const XS = [119, 45, 183];
const TOP = 14;

export function WeekMap({ game, scenarios, onOpen }: WeekMapProps) {
  // Title comes from the week config, so the map names whichever week is
  // being played rather than a hardcoded string.
  const week = weekConfig(game.week);
  const byCode = new Map(scenarios.map((s) => [s.code, s]));
  const nodes: MapNode[] = [
    ...game.attempts.map((a) => ({
      key: `done-${a.scenarioCode}`,
      title: byCode.get(a.scenarioCode)?.title ?? a.scenarioCode,
      domain: a.domain,
      state: 'done' as const,
      correct: a.correct,
    })),
    ...(game.current
      ? [
          {
            key: `current-${game.current.code}`,
            title: game.current.title,
            domain: game.current.domain,
            state: 'current' as const,
          },
        ]
      : []),
    ...[...game.chained, ...game.pending].map((s) => ({
      key: `locked-${s.code}`,
      title: s.title,
      domain: s.domain,
      state: 'locked' as const,
    })),
  ];

  const done = game.attempts.length;
  const total = nodes.length;
  const centers = nodes.map((_, i) => ({
    x: XS[i % XS.length] + NODE / 2,
    y: TOP + i * STEP + NODE / 2,
  }));
  const path = centers
    .map((c, i) => {
      if (i === 0) return `M${c.x},${c.y}`;
      const prev = centers[i - 1];
      return `C${prev.x},${prev.y + 52} ${c.x},${c.y - 52} ${c.x},${c.y}`;
    })
    .join(' ');
  const mapHeight = TOP + total * STEP + 26;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start gap-2 px-5 pt-3">
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.12em] text-accent">
            Week {game.week}
          </div>
          <div className="font-display text-xl font-semibold leading-tight">
            {week?.title ?? `Week ${game.week}`}
          </div>
        </div>
        <div className="font-display text-lg text-mute">
          <span className="text-accent">{done}</span>/{total}
        </div>
      </div>
      <div className="flex gap-4 px-5 pb-2 pt-1 text-[10px] text-mute">
        <span className="flex items-center gap-1.5">
          <DomainDot domain="implement-manage" /> Implement
        </span>
        <span className="flex items-center gap-1.5">
          <DomainDot domain="ingest-transform" /> Ingest
        </span>
        <span className="flex items-center gap-1.5">
          <DomainDot domain="monitor-optimize" /> Monitor
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pt-1.5">
        <div className="relative mx-auto w-[300px]" style={{ height: mapHeight }}>
          <svg
            width="300"
            height={mapHeight}
            viewBox={`0 0 300 ${mapHeight}`}
            className="absolute left-0 top-0"
            fill="none"
            aria-hidden
          >
            <path
              d={path}
              stroke="var(--color-accent)"
              strokeWidth="2"
              strokeDasharray="1 9"
              strokeLinecap="round"
              opacity="0.55"
            />
          </svg>

          {nodes.map((node, i) => {
            const x = XS[i % XS.length];
            const y = TOP + i * STEP;
            const labelStyle: React.CSSProperties = {
              position: 'absolute',
              left: x + NODE / 2 - 56,
              top: y + NODE + (node.state === 'current' ? 12 : 4),
              width: 112,
            };
            if (node.state === 'current') {
              return (
                <div key={node.key}>
                  <button
                    type="button"
                    onClick={onOpen}
                    data-testid="map-node-open"
                    aria-label={`Open incident: ${node.title}`}
                    className="absolute"
                    style={{ left: x - 3, top: y - 3, width: CURRENT + 6, height: CURRENT + 6 }}
                  >
                    <span
                      className="absolute inset-[3px] rounded-full border-2 border-accent"
                      style={{ animation: 'cc-pulse 2.2s ease-out infinite' }}
                      aria-hidden
                    />
                    <span
                      className="absolute inset-0 m-[3px] flex items-center justify-center rounded-full border-2 border-accent bg-bg text-accent shadow-card"
                    >
                      <IconPlay size={24} />
                    </span>
                    <span
                      className="absolute flex h-[15px] w-[15px] items-center justify-center rounded-full bg-bg"
                      style={{ top: 0, right: 0 }}
                      aria-hidden
                    >
                      <DomainDot domain={node.domain} />
                    </span>
                  </button>
                  <div
                    className="absolute rounded-full border border-accent bg-bg px-2.5 py-0.5 text-[9px] font-semibold tracking-[0.1em] text-accent"
                    style={{ left: x + 8, top: y - 20 }}
                  >
                    OPEN
                  </div>
                  <div
                    className="text-center text-[11px] font-semibold leading-tight text-ink"
                    style={labelStyle}
                  >
                    {node.title}
                  </div>
                </div>
              );
            }
            const isDone = node.state === 'done';
            return (
              <div key={node.key}>
                <div
                  className={
                    isDone
                      ? 'absolute flex items-center justify-center rounded-full border-2 border-accent bg-tint text-accent shadow-card'
                      : 'absolute flex items-center justify-center rounded-full border-2 border-dashed border-soft bg-track/60 text-soft opacity-85'
                  }
                  style={{ left: x, top: y, width: NODE, height: NODE }}
                >
                  {isDone ? <IconCheck size={26} /> : <IconLock size={22} />}
                  <span
                    className="absolute flex h-[15px] w-[15px] items-center justify-center rounded-full bg-bg"
                    style={{ top: -1, right: -1 }}
                    aria-hidden
                  >
                    <DomainDot domain={node.domain} />
                  </span>
                </div>
                <div
                  className={`text-center text-[11px] leading-tight ${
                    isDone ? 'text-shade' : 'text-soft'
                  }`}
                  style={labelStyle}
                >
                  {node.title}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
