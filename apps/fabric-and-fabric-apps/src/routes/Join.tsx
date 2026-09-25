import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import FabricLogo from '@fabric-msft/svg-icons/Fabric32Color';

import { STAGE_TITLES } from '@/content/stageTitles';
import { usePollResults } from '@/hooks/usePollResults';
import { useSession } from '@/hooks/useSession';
import { createAttendee } from '@/services/attendees';
import {
  getPollOptions,
  getPolls,
  submitResponse,
  type PollOptionRow,
} from '@/services/polls';

const NAME_KEY = 'fabricTalk.name';
const votedKey = (pollId: string) => `fabricTalk.voted.${pollId}`;

const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.35 },
};

function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6f9f8] font-sans">
      <div className="h-1.5 w-full bg-[#4fd8b8]" />
      <div className="p-6">{children}</div>
    </div>
  );
}

export function JoinPage() {
  const { session, error } = useSession();
  const [name, setName] = useState<string | null>(() => localStorage.getItem(NAME_KEY));
  const [nameInput, setNameInput] = useState('');
  const [options, setOptions] = useState<PollOptionRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [voted, setVoted] = useState(false);
  const [votedLabel, setVotedLabel] = useState<string | null>(null);
  const [question, setQuestion] = useState<string | null>(null);

  const activePollId = session?.activePollId || null;
  const { tally, total } = usePollResults(voted ? activePollId : null);

  useEffect(() => {
    setSelected(null);
    if (!activePollId) {
      setOptions([]);
      setQuestion(null);
      setVoted(false);
      return;
    }
    setVoted(localStorage.getItem(votedKey(activePollId)) === '1');
    getPollOptions(activePollId).then(setOptions).catch(() => setOptions([]));
    getPolls()
      .then((polls) => setQuestion(polls.find((p) => p.id === activePollId)?.question ?? null))
      .catch(() => setQuestion(null));
  }, [activePollId]);

  if (!name) {
    return (
      <Chrome>
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
          <form
            className="w-full max-w-sm rounded-3xl border border-[#dceae6] bg-white p-8 shadow-lg shadow-teal-900/5"
            onSubmit={async (e) => {
              e.preventDefault();
              const trimmed = nameInput.trim().slice(0, 60);
              if (!trimmed) return;
              localStorage.setItem(NAME_KEY, trimmed);
              setName(trimmed);
              try {
                await createAttendee(trimmed);
              } catch {
                // Non-critical — the lobby headcount just won't include this person.
              }
            }}
          >
            <FabricLogo width={36} height={36} />
            <h1
              className="mt-4 text-2xl font-semibold text-[#10241f]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Join the room
            </h1>
            <label className="mt-6 block text-base text-[#10241f]/70" htmlFor="first-name">
              First name
            </label>
            <input
              id="first-name"
              autoFocus
              className="mt-2 w-full rounded-xl border border-[#dceae6] px-4 py-4 text-base text-[#10241f] outline-none focus:border-[#177e71]"
              placeholder="Your first name"
              value={nameInput}
              maxLength={60}
              onChange={(e) => setNameInput(e.target.value)}
            />
            <button
              type="submit"
              className="mt-4 w-full rounded-xl bg-[#0e6961] px-4 py-4 text-base font-medium text-white transition-colors disabled:bg-[#dceae6] disabled:text-[#10241f]/50"
              disabled={!nameInput.trim()}
            >
              Join
            </button>
          </form>
        </div>
      </Chrome>
    );
  }

  if (error && !session) {
    return (
      <Chrome>
        <p className="mt-24 text-center text-base text-red-600">{error}</p>
      </Chrome>
    );
  }

  return (
    <Chrome>
      <div className="mx-auto max-w-md">
        <AnimatePresence mode="wait">
          {!activePollId ? (
            <motion.div key="waiting" {...fade} className="mt-16 flex flex-col items-center gap-3 text-center">
              <FabricLogo width={32} height={32} />
              <p className="text-lg text-[#10241f]">Hi {name}</p>
              <p className="text-base text-[#10241f]/60">
                {session ? `Now: ${STAGE_TITLES[session.stage]}` : 'Connecting…'}
              </p>
            </motion.div>
          ) : voted ? (
            <motion.div key="voted" {...fade} className="mt-16 flex flex-col items-center gap-6 text-center">
              <p className="text-xl text-[#10241f]">
                You picked <strong>{votedLabel}</strong>. Watch the big screen.
              </p>
              <div className="w-full space-y-3">
                {options.map((option) => {
                  const count = tally[option.id] ?? 0;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={option.id} className="text-left">
                      <div className="flex justify-between text-sm text-[#10241f]/70">
                        <span>{option.label}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="mt-1 h-2.5 w-full rounded-full bg-[#eef5f3]">
                        <motion.div
                          className="h-2.5 rounded-full bg-[#0e6961]"
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div key="poll" {...fade}>
              <p className="text-base text-[#10241f]/60">Hi {name}</p>
              <p className="mt-1 text-2xl font-semibold text-[#10241f]">
                {question ?? 'Loading…'}
              </p>
              <div className="mt-5 space-y-3">
                {options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelected(option.id)}
                    className={`w-full rounded-xl border-2 px-5 py-4 text-left text-lg transition-colors ${
                      selected === option.id
                        ? 'border-[#0e6961] bg-[#0e6961] text-white'
                        : 'border-[#dceae6] bg-white text-[#10241f]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={!selected || submitting}
                onClick={async () => {
                  if (!selected || !activePollId) return;
                  setSubmitting(true);
                  try {
                    await submitResponse(activePollId, selected, name);
                    localStorage.setItem(votedKey(activePollId), '1');
                    setVotedLabel(options.find((o) => o.id === selected)?.label ?? null);
                    setVoted(true);
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="mt-6 w-full rounded-xl bg-[#0e6961] px-4 py-4 text-base font-medium text-white transition-colors disabled:bg-[#dceae6] disabled:text-[#10241f]/50"
              >
                {submitting ? 'Sending...' : 'Submit'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Chrome>
  );
}
