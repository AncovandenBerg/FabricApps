// Briefing / home screen from the mockups: greeting, exam countdown with
// readiness ring, start-or-resume card, lifetime mastery, campaign list.
// Every week-specific number here (day count, incident count, CU budget,
// title, story) comes from the week config, never from a constant.
import { useState } from 'react';

import { IconChevron, IconPlay, Ring } from '@/components/bits';
import { MasteryBars } from '@/components/MasteryBars';
import { WeekList } from '@/components/WeekList';
import { WEEKS, type WeekConfig } from '@/game/campaign';
import type { GameState } from '@/game/engine';
import {
  daysToExam,
  readinessPercent,
  type PlayerProgress,
} from '@/game/progress';

interface HomeScreenProps {
  firstName: string;
  progress: PlayerProgress;
  /** The running week, when one can be resumed. */
  activeGame: GameState | null;
  /** Week the start button targets when nothing is running. */
  nextWeek: WeekConfig;
  /** Incidents per campaign week, keyed by week number. */
  incidentCounts: Record<number, number>;
  onStartOrResume: () => void;
  onSelectWeek: (weekNumber: number) => void;
  onSetExamDate: (isoDate: string) => void;
}

export function HomeScreen({
  firstName,
  progress,
  activeGame,
  nextWeek,
  incidentCounts,
  onStartOrResume,
  onSelectWeek,
  onSetExamDate,
}: HomeScreenProps) {
  const [editingDate, setEditingDate] = useState(false);
  const days = daysToExam(progress, new Date());
  const readiness = readinessPercent(progress);
  const week = activeGame
    ? (WEEKS.find((w) => w.number === activeGame.week) ?? nextWeek)
    : nextWeek;
  const incidents = incidentCounts[week.number] ?? 0;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-accent">
        Monday 07:58 · Nordwind HQ
      </div>
      <h2 className="mt-1 font-display text-[27px] font-semibold leading-none">
        Good morning,
        <br />
        {firstName}
      </h2>

      {/* Exam countdown */}
      <div className="mt-4 flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.1em] text-mute">
            Exam DP-700
          </div>
          {days !== null ? (
            <>
              <div className="font-display text-[26px] font-semibold leading-none">
                <span className="text-accent">{days}</span> days
              </div>
              <div className="mt-1 text-[11px] text-mute">
                Fabric Data Engineer
              </div>
            </>
          ) : (
            <div className="mt-0.5 text-sm text-shade">
              No exam date set yet.
            </div>
          )}
          {editingDate ? (
            <input
              type="date"
              autoFocus
              defaultValue={progress.examDate}
              onChange={(e) => {
                if (e.target.value) {
                  onSetExamDate(e.target.value);
                  setEditingDate(false);
                }
              }}
              className="mt-2 rounded-lg border border-line bg-bg px-2 py-1 text-xs text-ink"
              aria-label="Exam date"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingDate(true)}
              className="mt-2 text-xs text-accent underline underline-offset-2 hover:text-accent-deep"
            >
              {days !== null ? 'Change exam date' : 'Set exam date'}
            </button>
          )}
        </div>
        <Ring
          percent={readiness}
          size={72}
          strokeWidth={6}
          value={`${readiness}%`}
          caption="READY"
        />
      </div>

      {/* Start / resume */}
      <button
        type="button"
        onClick={onStartOrResume}
        data-testid="start-week"
        className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left shadow-card transition-colors hover:border-accent"
      >
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full border-[1.5px] border-accent text-accent">
          <IconPlay size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] uppercase tracking-[0.1em] text-accent">
            {activeGame
              ? `Resume week ${week.number}`
              : `Start week ${week.number}`}
          </span>
          <span className="block truncate font-display text-base font-semibold leading-tight text-ink">
            {activeGame
              ? `Day ${activeGame.day} · ${activeGame.current?.title ?? 'Continue'}`
              : week.title}
          </span>
          <span className="block text-[11px] text-mute">
            {activeGame
              ? `CU ${activeGame.cu} · SLA ${activeGame.sla} · ${activeGame.attempts.length} done`
              : `${week.days} days on call · ${incidents} incidents · ${week.startingCu} CU`}
          </span>
        </span>
        <IconChevron size={18} className="flex-none text-soft" />
      </button>

      {!activeGame && (
        <p className="mt-3 px-1 text-xs leading-relaxed text-mute">
          {week.subtitle} Incidents arrive daily. Every decision costs Capacity
          Units and moves your SLA, and careless calls come back as follow-up
          incidents. Every incident maps to a DP-700 exam objective.
        </p>
      )}

      {/* Lifetime mastery */}
      <div className="mb-2.5 mt-5 text-[9px] uppercase tracking-[0.12em] text-mute">
        Mastery by exam domain
      </div>
      {Object.keys(progress.domainTotals).length > 0 ? (
        <MasteryBars
          entries={Object.entries(progress.domainTotals).map(([domain, t]) => ({
            domain,
            percentage: t.total === 0 ? 0 : Math.round((t.correct / t.total) * 100),
          }))}
        />
      ) : (
        <p className="text-xs text-soft">
          Finish your first week to see where you stand per domain.
        </p>
      )}

      <div className="mb-2.5 mt-5 flex items-baseline justify-between">
        <div className="text-[9px] uppercase tracking-[0.12em] text-mute">
          Campaign
        </div>
        <div className="text-[11px] text-soft">
          {progress.completedWeeks.length}/{WEEKS.length} weeks cleared
        </div>
      </div>
      <WeekList
        progress={progress}
        currentWeek={week.number}
        activeWeek={activeGame?.week ?? null}
        incidentCounts={incidentCounts}
        onSelect={onSelectWeek}
      />
    </div>
  );
}
