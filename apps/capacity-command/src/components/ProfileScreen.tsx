// Profile tab: player identity, exam date, sign out.
import { useState } from 'react';

import { IconSignOut } from '@/components/bits';
import type { PlayerProgress } from '@/game/progress';

interface ProfileScreenProps {
  name: string;
  email: string;
  initials: string;
  progress: PlayerProgress;
  onSetExamDate: (isoDate: string) => void;
  onSignOut: () => void;
}

/** DD.MM.YYYY, per the app's date convention. */
function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

export function ProfileScreen({
  name,
  email,
  initials,
  progress,
  onSetExamDate,
  onSignOut,
}: ProfileScreenProps) {
  const [editingDate, setEditingDate] = useState(false);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-3">
      <div className="flex items-center gap-3.5 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full border border-line bg-bg font-display text-lg font-semibold text-accent">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg font-semibold leading-tight">
            {name}
          </div>
          <div className="truncate text-xs text-mute">{email}</div>
          <div className="text-[11px] text-soft">Platform admin · Nordwind Logistics</div>
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
          {progress.weeksCompleted} weeks completed
        </div>
      </div>

      <button
        type="button"
        onClick={onSignOut}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-2.5 text-sm text-shade transition-colors hover:border-bad hover:text-bad"
      >
        <IconSignOut size={16} /> Sign out
      </button>
    </div>
  );
}
