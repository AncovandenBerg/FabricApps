// Profile tab: player name, exam date, progress, and local-data controls.
// There is no account to sign out of, so the destructive action here clears
// this browser's saved data instead.
import { useState } from 'react';

import { WEEKS } from '@/game/campaign';
import { exportTelemetry } from '@/game/telemetry';
import type { PlayerProgress } from '@/game/progress';

interface ProfileScreenProps {
  name: string;
  initials: string;
  progress: PlayerProgress;
  onSetExamDate: (isoDate: string) => void;
  onRename: (name: string) => void;
  onReset: () => void;
}

/** DD.MM.YYYY, per the app's date convention. */
function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

/** Offer the decision log as a JSON download, for analysis outside the app. */
function downloadTelemetry(): void {
  const blob = new Blob([exportTelemetry()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'capacity-command-history.json';
  link.click();
  URL.revokeObjectURL(url);
}

export function ProfileScreen({
  name,
  initials,
  progress,
  onSetExamDate,
  onRename,
  onReset,
}: ProfileScreenProps) {
  const [editingDate, setEditingDate] = useState(false);
  const [editingName, setEditingName] = useState(false);
  // Reset wipes everything, so it takes a second, deliberate click.
  const [confirmingReset, setConfirmingReset] = useState(false);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-3">
      <div className="flex items-center gap-3.5 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full border border-line bg-bg font-display text-lg font-semibold text-accent">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          {editingName ? (
            <input
              type="text"
              autoFocus
              defaultValue={name}
              maxLength={40}
              aria-label="Display name"
              onBlur={(e) => {
                onRename(e.target.value);
                setEditingName(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') setEditingName(false);
              }}
              className="w-full rounded-lg border border-line bg-bg px-2 py-1 font-display text-base text-ink"
            />
          ) : (
            <div className="truncate font-display text-lg font-semibold leading-tight">
              {name}
            </div>
          )}
          <div className="truncate text-xs text-mute">
            Playing as guest · saved in this browser
          </div>
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="mt-0.5 text-[11px] text-accent underline underline-offset-2 hover:text-accent-deep"
          >
            Change name
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div className="text-[10px] uppercase tracking-[0.1em] text-mute">
          Exam DP-700
        </div>
        <div className="mt-1 text-sm text-ink">
          {progress.examDate
            ? `Planned for ${formatDate(progress.examDate)}`
            : 'No exam date set.'}
        </div>
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
            {progress.examDate ? 'Change exam date' : 'Set exam date'}
          </button>
        )}
      </div>

      <div className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div className="text-[10px] uppercase tracking-[0.1em] text-mute">
          Progress
        </div>
        <div className="mt-1 text-sm text-ink">
          {progress.completedWeeks.length} of {WEEKS.length} campaign weeks
          cleared
        </div>
        <div className="text-xs text-mute">
          {progress.weeksCompleted} weeks played, replays included
        </div>
        <button
          type="button"
          onClick={downloadTelemetry}
          className="mt-2 text-xs text-accent underline underline-offset-2 hover:text-accent-deep"
        >
          Download decision history (JSON)
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          if (confirmingReset) {
            onReset();
            setConfirmingReset(false);
          } else {
            setConfirmingReset(true);
          }
        }}
        onBlur={() => setConfirmingReset(false)}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-2.5 text-sm text-shade transition-colors hover:border-bad hover:text-bad"
      >
        {confirmingReset ? 'Tap again to erase everything' : 'Reset my progress'}
      </button>
      <p className="mt-2 text-center text-xs text-soft">
        Nothing leaves this browser. Clearing site data removes your progress.
      </p>
    </div>
  );
}
