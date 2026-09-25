import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DomainDot, IconSignOut } from '@/components/bits';
import { FeedbackPanel } from '@/components/FeedbackPanel';
import { HomeScreen } from '@/components/HomeScreen';
import { ProfileScreen } from '@/components/ProfileScreen';
import { ReportScreen } from '@/components/ReportScreen';
import { StatsScreen } from '@/components/StatsScreen';
import { TabBar, type Tab } from '@/components/TabBar';
import { WeekMap } from '@/components/WeekMap';
import { isWeekUnlocked, nextWeek, weekAfter, WEEKS } from '@/game/campaign';
import { loadScenarios, type ScenarioLoader } from '@/game/data';
import { domainMeta } from '@/game/domains';
import {
  advance,
  buildWeek,
  choose,
  restoreGame,
  serializeGame,
  startGame,
  type GameState,
} from '@/game/engine';
import {
  loadProgress,
  recordWeek,
  saveProgress,
  type PlayerProgress,
} from '@/game/progress';
import { createTelemetry, type GameTelemetry } from '@/game/telemetry';
import type { GameScenario } from '@/game/types';
import { useAuth } from '@/hooks/AuthContext';

interface GamePageProps {
  /** Injection points for tests; real implementations are the default. */
  loader?: ScenarioLoader;
  telemetry?: GameTelemetry;
}

type Screen = 'tabs' | 'incident' | 'report';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function StatusStrip({ game }: { game: GameState }) {
  return (
    <div className="flex items-center gap-3.5 px-5 pb-2.5">
      <div className="text-[11px] uppercase tracking-[0.06em] text-mute" data-testid="status-day">
        Day <strong className="font-semibold text-ink">{game.day}</strong>/
        {game.weekLength}
      </div>
      <div className="text-[11px] uppercase tracking-[0.06em] text-soft" data-testid="status-week">
        W{game.week}
      </div>
      <div className="flex-1" />
      <div className="text-right">
        <div className="text-[10px] text-mute" data-testid="status-cu">
          CU <strong className="font-display text-xs font-semibold text-ink">{game.cu}</strong>
        </div>
        <div className="mt-0.5 h-[3px] w-[52px] rounded-sm bg-track">
          <div
            className="h-full bg-accent"
            style={{ width: `${Math.min(100, (game.cu / game.startingCu) * 100)}%` }}
          />
        </div>
      </div>
      <div className="text-right">
        <div className="text-[10px] text-mute" data-testid="status-sla">
          SLA <strong className="font-display text-xs font-semibold text-ink">{game.sla}</strong>
        </div>
        <div className="mt-0.5 h-[3px] w-[52px] rounded-sm bg-track">
          <div
            className="h-full bg-accent"
            style={{
              width: `${Math.min(100, (game.sla / (game.startingSla * 2)) * 100)}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function GamePage({ loader, telemetry: telemetryProp }: GamePageProps) {
  const { user, signOut } = useAuth();
  const telemetry = useMemo(
    () => telemetryProp ?? createTelemetry(),
    [telemetryProp]
  );

  const [scenarios, setScenarios] = useState<GameScenario[] | null>(null);
  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [screen, setScreen] = useState<Screen>('tabs');
  const [loadError, setLoadError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const shownAtRef = useRef<number>(Date.now());

  const persist = useCallback(
    (next: PlayerProgress) => {
      setProgress(next);
      if (user) saveProgress(user.id, next);
    },
    [user]
  );

  const saveActive = useCallback(
    (g: GameState, base: PlayerProgress) => {
      persist({
        ...base,
        active: { sessionId: sessionIdRef.current, game: serializeGame(g) },
      });
    },
    [persist]
  );

  useEffect(() => {
    let cancelled = false;
    (loader ?? loadScenarios)()
      .then((loaded) => {
        if (cancelled || !user) return;
        setScenarios(loaded);
        const stored = loadProgress(user.id);
        // Resume a week that was in flight when the page last closed
        if (stored.active) {
          const restored = restoreGame(stored.active.game, loaded);
          if (restored.phase !== 'summary') {
            sessionIdRef.current = stored.active.sessionId;
            setGame(restored);
          } else {
            stored.active = undefined;
          }
        }
        setProgress(stored);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : 'Failed to load scenarios.'
          );
        }
      });
    return () => {
      cancelled = true;
    };
    // The loader runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginSession = useCallback(
    async (weekNumber: number) => {
      if (!scenarios || !progress) return;
      // Sequential unlock: never start a week the player has not earned.
      if (!isWeekUnlocked(weekNumber, progress.completedWeeks)) return;
      const fresh = startGame(scenarios, weekNumber);
      setGame(fresh);
      setTab('map');
      setScreen('tabs');
      sessionIdRef.current = user
        ? await telemetry.startSession(user.id, {
            weekNumber: fresh.week,
            startingCu: fresh.startingCu,
            startingSla: fresh.startingSla,
            startingDay: fresh.day,
          })
        : null;
      saveActive(fresh, { ...progress, active: undefined });
    },
    [scenarios, progress, telemetry, user, saveActive]
  );

  const handleStartOrResume = () => {
    if (game) {
      setTab('map');
      setScreen('tabs');
    } else if (progress) {
      void beginSession(nextWeek(progress.completedWeeks).number);
    }
  };

  /**
   * Picking a week from the campaign list. A week already in flight is
   * resumed rather than restarted, so a half-played week is never lost to
   * a stray tap.
   */
  const handleSelectWeek = (weekNumber: number) => {
    if (game?.week === weekNumber) {
      setTab('map');
      setScreen('tabs');
      return;
    }
    void beginSession(weekNumber);
  };

  const handleOpenIncident = () => {
    shownAtRef.current = Date.now();
    setScreen('incident');
  };

  const handleChoose = (optionKey: string) => {
    if (!game || !scenarios || !progress) return;
    const secondsToDecide = (Date.now() - shownAtRef.current) / 1000;
    const next = choose(game, optionKey, secondsToDecide, scenarios);
    setGame(next);
    saveActive(next, progress);

    const sessionId = sessionIdRef.current;
    if (sessionId && user && next.lastAttempt) {
      void telemetry.recordAttempt(sessionId, user.id, next.lastAttempt);
      void telemetry.syncSession(sessionId, {
        cuRemaining: next.cu,
        slaScore: next.sla,
        currentDay: next.day,
      });
    }
  };

  const handleContinue = () => {
    if (!game || !progress) return;
    const next = advance(game);
    setGame(next);

    if (next.phase === 'summary') {
      persist(
        recordWeek(progress, next.week, next.attempts, next.cu, next.sla)
      );
      setScreen('report');
      const sessionId = sessionIdRef.current;
      if (sessionId) {
        void telemetry.completeSession(sessionId, {
          cuRemaining: next.cu,
          slaScore: next.sla,
          currentDay: next.day,
        });
      }
      sessionIdRef.current = null;
    } else {
      saveActive(next, progress);
      setScreen('tabs');
      setTab('map');
    }
  };

  const handleReportHome = () => {
    setGame(null);
    setScreen('tabs');
    setTab('home');
  };

  const handleSetExamDate = (isoDate: string) => {
    if (progress) persist({ ...progress, examDate: isoDate });
  };

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-sm rounded-2xl border border-bad/50 bg-surface p-5 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-bad">
            Connection lost
          </p>
          <p className="mt-2 text-sm text-shade">
            Could not load the week&apos;s incidents.
          </p>
          <p className="mt-1 text-xs text-soft">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!scenarios || !progress || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-mute">
          Preparing your week at Nordwind Logistics...
        </p>
      </div>
    );
  }

  const dom = game?.current ? domainMeta(game.current.domain) : null;
  // Playable incidents per configured week, for the campaign list.
  const incidentCounts = Object.fromEntries(
    WEEKS.map((w) => [w.number, buildWeek(scenarios, w.number).length])
  );
  const upcoming = nextWeek(progress.completedWeeks);

  return (
    <div className="flex min-h-screen justify-center bg-canvas">
      <div className="flex min-h-screen w-full max-w-[420px] flex-col border-x border-line bg-bg">
        {screen !== 'report' && (
          <header className="flex items-center gap-2.5 px-5 pb-2 pt-4">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-line bg-surface font-display text-sm font-semibold text-accent">
              {initials(user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 font-display text-base font-semibold leading-tight">
                <span className="inline-block h-[7px] w-[7px] bg-accent" aria-hidden />
                Capacity Command
              </div>
              <div className="truncate text-[11px] text-mute">
                {user.name} · Platform admin
              </div>
            </div>
            <button
              onClick={() => void signOut()}
              aria-label="Sign out"
              className="text-soft transition-colors hover:text-shade"
            >
              <IconSignOut size={18} />
            </button>
          </header>
        )}

        {screen === 'report' && game ? (
          <ReportScreen
            weekNumber={game.week}
            cu={game.cu}
            sla={game.sla}
            attempts={game.attempts}
            scenarios={scenarios}
            unlockedWeek={weekAfter(game.week, progress.completedWeeks)}
            onPlayWeek={(week) => void beginSession(week)}
            onHome={handleReportHome}
          />
        ) : screen === 'incident' && game?.current ? (
          <>
            <StatusStrip game={game} />
            <div className="mx-5 h-px bg-line" />
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4">
              <div className="rounded-2xl border border-line bg-surface shadow-card">
                <div className="flex items-center gap-2.5 border-b border-line px-4 py-2.5 text-[10px] uppercase tracking-[0.1em]">
                  <span className="font-semibold text-accent">{game.current.code}</span>
                  <span className="text-soft">Day {game.current.day}</span>
                  <span className="flex items-center gap-1.5 text-mute">
                    <DomainDot domain={game.current.domain} />
                    {dom?.short}
                  </span>
                  {game.current.isFollowUp && (
                    <span className="ml-auto font-semibold text-bad">follow-up</span>
                  )}
                </div>
                <div className="px-4 py-3.5">
                  <h2 className="font-display text-xl font-semibold leading-tight">
                    {game.current.title}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-shade">
                    {game.current.incident}
                  </p>
                </div>
              </div>

              {game.phase === 'incident' ? (
                <div className="mt-3 flex flex-col gap-2">
                  {game.current.options.map((option) => (
                    <button
                      key={option.optionKey}
                      type="button"
                      onClick={() => handleChoose(option.optionKey)}
                      className="group flex w-full items-baseline gap-3 rounded-2xl border border-line bg-surface p-3.5 text-left shadow-card transition-colors hover:border-accent"
                    >
                      <span className="flex h-6 w-6 flex-none translate-y-0.5 items-center justify-center rounded-full border border-line font-display text-xs font-semibold text-shade transition-colors group-hover:border-accent group-hover:text-accent">
                        {option.optionKey}
                      </span>
                      <span className="flex-1 text-sm leading-snug text-ink">
                        {option.optionText}
                      </span>
                      <span className="flex-none text-[11px] text-soft">
                        {option.cuCost} CU
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                game.lastAttempt && (
                  <div className="mt-3">
                    <FeedbackPanel
                      scenario={game.current}
                      attempt={game.lastAttempt}
                      hasFollowUp={game.chained.length > 0}
                      onContinue={handleContinue}
                    />
                  </div>
                )
              )}
            </div>
          </>
        ) : (
          <>
            {tab === 'home' && (
              <HomeScreen
                firstName={user.name.split(/\s+/)[0]}
                progress={progress}
                activeGame={game}
                nextWeek={upcoming}
                incidentCounts={incidentCounts}
                onStartOrResume={handleStartOrResume}
                onSelectWeek={handleSelectWeek}
                onSetExamDate={handleSetExamDate}
              />
            )}
            {tab === 'map' &&
              (game ? (
                <>
                  <StatusStrip game={game} />
                  <div className="mx-5 h-px bg-line" />
                  <WeekMap
                    game={game}
                    scenarios={scenarios}
                    onOpen={handleOpenIncident}
                  />
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
                  <p className="text-sm text-mute">
                    No week in progress. Clock in from the home screen to get
                    your first incident.
                  </p>
                  <button
                    type="button"
                    onClick={() => void beginSession(upcoming.number)}
                    className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-deep"
                  >
                    Start week {upcoming.number}: {upcoming.title}
                  </button>
                </div>
              ))}
            {tab === 'stats' && <StatsScreen progress={progress} />}
            {tab === 'profile' && (
              <ProfileScreen
                name={user.name}
                email={user.email || 'Shared-link guest'}
                initials={initials(user.name)}
                progress={progress}
                onSetExamDate={handleSetExamDate}
                onSignOut={() => void signOut()}
              />
            )}
            <TabBar active={tab} onSelect={setTab} />
          </>
        )}
      </div>
    </div>
  );
}
