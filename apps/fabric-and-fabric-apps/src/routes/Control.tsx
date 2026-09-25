import { useEffect, useState } from 'react';

import { HubDiagram } from '@/components/display/HubDiagram';
import { STAGE_TITLES } from '@/content/stageTitles';
import { useAuth } from '@/hooks/AuthContext';
import { useSession } from '@/hooks/useSession';
import { usePollResults } from '@/hooks/usePollResults';
import {
  createPoll,
  createPollOption,
  deletePoll,
  deletePollOption,
  getPollOptions,
  getPolls,
  updatePoll,
  updatePollOption,
  type PollOptionRow,
  type PollRow,
} from '@/services/polls';
import {
  ensureSession,
  resetSession,
  setActivePoll,
  setRevealStep,
  setStage,
  zoomToWorkload,
} from '@/services/session';
import { STAGES, type Stage } from '../../rayfin/data/Session';

const PLACEHOLDER_POLLS: Array<{
  question: string;
  stageKey: Stage;
  options: string[];
}> = [
  {
    question: 'What is Microsoft Fabric?',
    stageKey: 'lobby',
    options: [
      'Power BI but in a new shell',
      'a revolutionary new line of corporate trousers woven entirely out of recycled Excel spreadsheets.',
      'An all-in-one data analytics platform',
      'A Microsoft teams environment, specialized in data analytics',
    ],
  },
  {
    question: 'What do you think this screen is built with?',
    stageKey: 'workload_zoom',
    options: [
      'A PowerPoint deck',
      'A Power BI report',
      'A custom website',
      'A Fabric App',
    ],
  },
  {
    question: 'Before today, had you heard of Fabric Apps?',
    stageKey: 'fabric_apps_intro',
    options: [
      'Never heard of it',
      'Heard the name',
      'Tried it once',
      'Already building with it',
    ],
  },
];

const REVEAL_STEP_LABELS = ['1 · Poll result', '2 · The line', '3 · Evidence', '4 · The app'];

function useHubSize() {
  const [size, setSize] = useState(420);
  useEffect(() => {
    const update = () => setSize(Math.min(420, window.innerWidth - 64));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return size;
}

export function ControlPage() {
  const { signOut } = useAuth();
  const { session, error } = useSession();
  const [polls, setPolls] = useState<PollRow[]>([]);
  const [optionsByPoll, setOptionsByPoll] = useState<Record<string, PollOptionRow[]>>({});
  const [seeding, setSeeding] = useState(false);
  const [seedWarning, setSeedWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hubSize = useHubSize();
  const activePollId = session?.activePollId || null;
  const { tally, total } = usePollResults(activePollId);

  const refreshPolls = async () => {
    const rows = await getPolls();
    setPolls(rows);
    const entries = await Promise.all(
      rows.map(async (p) => [p.id, await getPollOptions(p.id)] as const)
    );
    setOptionsByPoll(Object.fromEntries(entries));
  };

  useEffect(() => {
    ensureSession()
      .then(refreshPolls)
      .catch(() => {
        /* surfaced via session hook's own error state */
      });
  }, []);

  /**
   * Creates any placeholder polls that don't exist yet (matched by position,
   * i.e. `order`), and updates ones that do — so re-running after editing
   * PLACEHOLDER_POLLS (including moving a question to a different stageKey)
   * pushes the new wording into already-seeded rows instead of leaving an
   * orphaned row behind under the old stageKey. Every poll not claimed by this
   * pass (leftovers from a longer PLACEHOLDER_POLLS, or duplicate rows that
   * already shared an `order` value some other row claimed first) is deleted
   * along with its options — pruning by id rather than by an order cutoff
   * also cleans up ties instead of silently leaving the second one behind.
   * Same idea one level down: any option past the current placeholder's
   * option count (leftover from when that question had more answers) is
   * deleted too, instead of lingering forever alongside the synced ones.
   *
   * A stale poll/option can already have PollResponse rows pointing at it
   * (someone voted for it), and PollResponse grants no role delete access
   * (see rayfin/data/PollResponse.ts) — so that row's delete is rejected by
   * the FK constraint. Each delete is therefore isolated in its own
   * try/catch: one un-deletable leftover must not abort the question/option
   * updates for every poll after it in the loop, which is what made syncing
   * look like it did nothing at all. Anything that couldn't be removed is
   * surfaced instead of silently left unexplained.
   */
  const seedPlaceholders = async () => {
    setSeeding(true);
    setSeedWarning(null);
    const undeletable: string[] = [];
    const tryDeleteOption = async (id: string, label: string) => {
      try {
        await deletePollOption(id);
      } catch {
        undeletable.push(`answer "${label}"`);
      }
    };
    try {
      const keepIds = new Set<string>();

      for (let i = 0; i < PLACEHOLDER_POLLS.length; i++) {
        const p = PLACEHOLDER_POLLS[i];
        const existingPoll = polls.find(
          (poll) => poll.order === i + 1 && !keepIds.has(poll.id)
        );
        const pollId = existingPoll?.id ?? crypto.randomUUID();
        keepIds.add(pollId);
        if (existingPoll) {
          await updatePoll(pollId, p.question, p.stageKey, i + 1);
        } else {
          await createPoll(pollId, p.question, p.stageKey, i + 1);
        }

        const existingOptions = optionsByPoll[pollId] ?? [];
        for (let j = 0; j < p.options.length; j++) {
          const existingOption = existingOptions[j];
          if (existingOption) {
            await updatePollOption(existingOption.id, p.options[j], j + 1);
          } else {
            await createPollOption(crypto.randomUUID(), pollId, p.options[j], j + 1);
          }
        }
        for (const staleOption of existingOptions.slice(p.options.length)) {
          await tryDeleteOption(staleOption.id, staleOption.label);
        }
      }

      const stalePolls = polls.filter((poll) => !keepIds.has(poll.id));
      for (const poll of stalePolls) {
        for (const option of optionsByPoll[poll.id] ?? []) {
          await tryDeleteOption(option.id, option.label);
        }
        try {
          await deletePoll(poll.id);
        } catch {
          undeletable.push(`question "${poll.question}"`);
        }
      }

      if (undeletable.length > 0) {
        setSeedWarning(
          `Couldn't remove ${undeletable.join(', ')} — it already has responses recorded against it.`
        );
      }

      await refreshPolls();
    } finally {
      setSeeding(false);
    }
  };

  /** Closes any open poll first (advancing a stage shouldn't leave a poll open behind you), then jumps. */
  const goToStage = async (stage: Stage) => {
    setBusy(true);
    try {
      if (activePollId) await setActivePoll(null);
      await setStage(stage);
    } finally {
      setBusy(false);
    }
  };

  const stageIndex = session ? STAGES.indexOf(session.stage) : 0;
  const currentPoll = session ? polls.find((p) => p.stageKey === session.stage) : undefined;

  return (
    <div className="min-h-screen bg-[#f6f9f8] pb-28 font-sans text-[#10241f]">
      <div className="sticky top-0 z-10 border-b border-[#dceae6] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#4a5f59]">On the display now</p>
            <p className="text-lg font-semibold">
              {session ? STAGE_TITLES[session.stage] : 'Connecting…'}
            </p>
          </div>
          <button onClick={signOut} className="text-sm text-[#10241f]/50 underline">
            Sign out
          </button>
        </div>
        {currentPoll && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-[#eef8f6] px-4 py-2">
            <div>
              <p className="text-sm font-medium">{currentPoll.question}</p>
              {activePollId === currentPoll.id && (
                <p className="text-xs text-[#4a5f59]">{total} responses</p>
              )}
            </div>
            <button
              onClick={() => setActivePoll(activePollId === currentPoll.id ? null : currentPoll.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-white ${
                activePollId === currentPoll.id ? 'bg-red-600' : 'bg-[#0e6961]'
              }`}
            >
              {activePollId === currentPoll.id ? 'Close poll' : 'Open poll'}
            </button>
          </div>
        )}
      </div>

      <div className="p-6">
        {error && <p className="mb-4 text-red-600">{error}</p>}

        <section>
          <h2 className="text-sm uppercase tracking-widest text-[#4a5f59]">Stage</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {STAGES.map((stage) => (
              <button
                key={stage}
                disabled={busy}
                onClick={() => goToStage(stage)}
                className={`rounded-lg px-3 py-2 text-sm ${
                  session?.stage === stage
                    ? 'bg-[#0e6961] text-white'
                    : 'border border-[#dceae6] bg-white text-[#10241f]/80 hover:border-[#0e6961]'
                }`}
              >
                {STAGE_TITLES[stage]}
              </button>
            ))}
          </div>
        </section>

        {session?.stage === 'workload_zoom' && (
          <section className="mt-8">
            <h2 className="text-sm uppercase tracking-widest text-[#4a5f59]">
              Click a workload, then click it again to zoom back out
            </h2>
            <div className="mt-3 flex justify-center overflow-hidden rounded-2xl border border-[#dceae6] bg-white py-6">
              <HubDiagram
                size={hubSize}
                highlightIndex={session.currentWorkloadIndex}
                onSelect={(index) => {
                  if (session.currentWorkloadIndex === index) {
                    setStage('fabric_overview');
                  } else {
                    zoomToWorkload(index);
                  }
                }}
                onSelectCenter={() => setStage('fabric_overview')}
              />
            </div>
          </section>
        )}

        {session?.stage === 'reveal' && (
          <section className="mt-8">
            <h2 className="text-sm uppercase tracking-widest text-[#4a5f59]">Reveal step</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {REVEAL_STEP_LABELS.map((label, i) => (
                <button
                  key={label}
                  onClick={() => setRevealStep(i)}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    session.revealStep === i
                      ? 'bg-[#0e6961] text-white'
                      : 'border border-[#dceae6] bg-white text-[#10241f]/80 hover:border-[#0e6961]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-sm uppercase tracking-widest text-[#4a5f59]">Polls</h2>
            <button
              disabled={seeding}
              onClick={seedPlaceholders}
              className="rounded-lg bg-[#0e6961] px-3 py-2 text-sm text-white disabled:bg-[#dceae6] disabled:text-[#10241f]/50"
            >
              {seeding
                ? 'Syncing...'
                : polls.length === 0
                  ? 'Seed 3 placeholder polls'
                  : 'Sync placeholder poll text'}
            </button>
          </div>

          {seedWarning && (
            <p className="mt-2 text-sm text-amber-700">{seedWarning}</p>
          )}

          <div className="mt-3 space-y-3">
            {polls.map((poll) => {
              const isActive = activePollId === poll.id;
              return (
                <div key={poll.id} className="rounded-xl border border-[#dceae6] bg-white p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-[#10241f]/45">
                        stage: {STAGE_TITLES[poll.stageKey as Stage] ?? poll.stageKey}
                      </p>
                      <p className="font-medium">{poll.question}</p>
                    </div>
                    <button
                      onClick={() => setActivePoll(isActive ? null : poll.id)}
                      className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm text-white ${
                        isActive ? 'bg-red-600' : 'bg-[#0e6961]'
                      }`}
                    >
                      {isActive ? 'Close poll' : 'Open poll'}
                    </button>
                  </div>
                  {isActive && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs text-[#10241f]/45">{total} responses</p>
                      {(optionsByPoll[poll.id] ?? []).map((option) => (
                        <div key={option.id} className="flex justify-between text-sm">
                          <span>{option.label}</span>
                          <span>{tally[option.id] ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <button
            onClick={() => {
              if (window.confirm('Reset the session back to the lobby? This is for rehearsals.')) {
                resetSession();
              }
            }}
            className="rounded-lg border border-[#dceae6] bg-white px-3 py-2 text-sm text-[#10241f]/70 hover:border-red-400 hover:text-red-600"
          >
            Reset session
          </button>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 flex gap-3 border-t border-[#dceae6] bg-white p-4">
        <button
          disabled={busy || stageIndex <= 0}
          onClick={() => goToStage(STAGES[Math.max(0, stageIndex - 1)])}
          className="flex-1 rounded-xl bg-[#dceae6] py-4 text-lg font-medium text-[#10241f] disabled:opacity-40"
        >
          ← Previous
        </button>
        <button
          disabled={busy || stageIndex >= STAGES.length - 1}
          onClick={() => goToStage(STAGES[Math.min(STAGES.length - 1, stageIndex + 1)])}
          className="flex-1 rounded-xl bg-[#0e6961] py-4 text-lg font-medium text-white disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
