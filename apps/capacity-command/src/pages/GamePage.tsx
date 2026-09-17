import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DomainDot } from '@/components/bits';
import { BreachScreen } from '@/components/BreachScreen';
import { FeedbackPanel } from '@/components/FeedbackPanel';
import { HomeScreen } from '@/components/HomeScreen';
import { ProfileScreen } from '@/components/ProfileScreen';
import { ReportScreen } from '@/components/ReportScreen';
import { StatsScreen } from '@/components/StatsScreen';
import { TabBar, type Tab } from '@/components/TabBar';
import { WeekMap } from '@/components/WeekMap';
import { isWeekUnlocked, nextWeek, weekAfter, WEEKS } from '@/game/campaign';
import { loadScenarios, type ScenarioLoader } from '@/game/data';
import { resolveWeekLink } from '@/game/deepLink';
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
  emptyProgress,
  loadProgress,
  recordWeek,
  saveProgress,
  type PlayerProgress,
} from '@/game/progress';
import { createTelemetry, type GameTelemetry } from '@/game/telemetry';
import type { GameScenario } from '@/game/types';
import { usePlayer } from '@/hooks/usePlayer';

interface GamePageProps {
  /** Injection points for tests; real implementations are the default. */
  loader?: ScenarioLoader;
  telemetry?: GameTelemetry;
  /**
   * Query string to read the `?week=<n>` deep link from. Defaults to the real
   * one; tests pass a literal so they never touch `window.location`.
   */
  search?: string;
}

type Screen = 'tabs' | 'incident' | 'report' | 'breach';

/** The two screens that own the whole viewport, header and tab bar included. */
function isEndScreen(screen: Screen): boolean {
  return screen === 'report' || screen === 'breach';
}

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

export function GamePage({
  loader,
  telemetry: telemetryProp,
  search,
}: GamePageProps) {
  const { player, rename, reset } = usePlayer();
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
  /** A deep link is a one-time instruction, not standing state. */
  const weekLinkHandledRef = useRef(false);

  const persist = useCallback(
    (next: PlayerProgress) => {
      setProgress(next);
      saveProgress(player.id, next);
    },
    [player.id]
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
        if (cancelled) return;
        setScenarios(loaded);
        const stored = loadProgress(player.id);
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
      sessionIdRef.current = await telemetry.startSession(player.id, {
        weekNumber: fresh.week,
        startingCu: fresh.startingCu,
        startingSla: fresh.startingSla,
        startingDay: fresh.day,
      });
      saveActive(fresh, { ...progress, active: undefined });
    },
    [scenarios, progress, telemetry, player.id, saveActive]
  );

  /**
   * Act on a `?week=<n>` link once the save file is known.
   *
   * It has to wait for `progress`, because whether a week is unlocked — and
   * whether one is already in flight — is exactly what decides the answer.
   * Both are set in the same tick by the loader above, so by the time
   * `progress` is non-null a resumed `game` is already in state and this
   * cannot mistake a resumable week for an idle app.
   *
   * The ref makes it fire once. Without it, finishing the linked week would
   * re-run this and start it again, which is a loop rather than a feature.
   * Every refusal simply falls through to the normal home screen, where the
   * week list shows what is actually open.
   */
  useEffect(() => {
    if (weekLinkHandledRef.current || !scenarios || !progress) return;
    weekLinkHandledRef.current = true;

    const action = resolveWeekLink(
      search ?? window.location.search,
      { completedWeeks: progress.completedWeeks, activeWeek: game?.week ?? null }
    );

    if (action.kind === 'start') {
      void beginSession(action.week);
    } else if (action.kind === 'resume') {
      setTab('map');
      setScreen('tabs');
    }
  }, [scenarios, progress, game, search, beginSession]);

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
    if (sessionId && next.lastAttempt) {
      void telemetry.recordAttempt(sessionId, player.id, next.lastAttempt);
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

    // Both terminal phases end the session and clear the in-flight save. A
    // breach differs only in what it records: the week is not cleared, so
    // nothing new unlocks.
    if (next.phase === 'summary' || next.phase === 'breach') {
      const outcome = next.phase === 'breach' ? 'breached' : 'completed';
      persist(
        recordWeek(progress, next.week, next.attempts, next.cu, next.sla, outcome)
      );
      setScreen(next.phase === 'breach' ? 'breach' : 'report');
      const sessionId = sessionIdRef.current;
      if (sessionId) {
        void telemetry.completeSession(
          sessionId,
          {
            cuRemaining: next.cu,
            slaScore: next.sla,
            currentDay: next.day,
          },
          outcome
        );
      }
      sessionIdRef.current = null;
    } else {
      saveActive(next, progress);
      setScreen('tabs');
      setTab('map');
    }
  };

  /** Leaving either end screen drops the finished run and returns to the tabs. */
  const handleEndScreenHome = () => {
    setGame(null);
    setScreen('tabs');
    setTab('home');
  };

  const handleSetExamDate = (isoDate: string) => {
    if (progress) persist({ ...progress, examDate: isoDate });
  };

  /** Wipe this browser's data and drop back to a fresh home screen. */
  const handleReset = () => {
    reset();
    sessionIdRef.current = null;
    setGame(null);
    setProgress(emptyProgress());
    setScreen('tabs');
    setTab('home');
  };

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-sm rounded-2xl border border-bad/50 bg-surface p-5 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-bad">
            Content unavailable
          </p>
          <p className="mt-2 text-sm text-shade">
            Could not load the week&apos;s incidents.
          </p>
          <p className="mt-1 text-xs text-soft">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!scenarios || !progress) {
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
        {!isEndScreen(screen) && (
          <header className="flex items-center gap-2.5 px-5 pb-2 pt-4">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-line bg-surface font-display text-sm font-semibold text-accent">
              {initials(player.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 font-display text-base font-semibold leading-tight">
                <span className="inline-block h-[7px] w-[7px] bg-accent" aria-hidden />
                Capacity Command
              </div>
              <div className="truncate text-[11px] text-mute">
                {player.name} · Platform admin
              </div>
            </div>
          </header>
        )}

        {screen === 'breach' && game?.breach ? (
          <BreachScreen
            weekNumber={game.week}
            day={game.day}
            weekLength={game.weekLength}
            sla={game.sla}
            breach={game.breach}
            attempts={game.attempts}
            remaining={game.pending.length + game.chained.length}
            alreadyCleared={progress.completedWeeks.includes(game.week)}
            scenarios={scenarios}
            onReplay={(week) => void beginSession(week)}
            onHome={handleEndScreenHome}
          />
        ) : screen === 'report' && game ? (
          <ReportScreen
            weekNumber={game.week}
            cu={game.cu}
            sla={game.sla}
            attempts={game.attempts}
            scenarios={scenarios}
            unlockedWeek={weekAfter(game.week, progress.completedWeeks)}
            onPlayWeek={(week) => void beginSession(week)}
            onHome={handleEndScreenHome}
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
                      breached={game.breach !== null}
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
                firstName={player.name.split(/\s+/)[0]}
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
                name={player.name}
                initials={initials(player.name)}
                progress={progress}
                onSetExamDate={handleSetExamDate}
                onRename={rename}
                onReset={handleReset}
              />
            )}
            <TabBar active={tab} onSelect={setTab} />
          </>
        )}
      </div>
    </div>
  );
}
