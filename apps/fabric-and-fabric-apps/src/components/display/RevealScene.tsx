import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';

import { usePollResults } from '@/hooks/usePollResults';
import type { PollOptionRow, PollRow } from '@/services/polls';

import { HubDiagram } from './HubDiagram';

interface RevealSceneProps {
  step: number;
  joinUrl: string;
  poll3?: PollRow;
  poll3Options: PollOptionRow[];
}

function PollResultBars({
  options,
  tally,
  total,
}: {
  options: PollOptionRow[];
  tally: Record<string, number>;
  total: number;
}) {
  return (
    <div className="mt-10 w-full max-w-3xl space-y-5">
      {options.map((option) => {
        const count = tally[option.id] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={option.id}>
            <div className="flex justify-between text-2xl text-[#10241f]">
              <span>{option.label}</span>
              <span className="font-medium">{pct}%</span>
            </div>
            <div className="mt-2 h-10 w-full rounded-full bg-[#eef5f3]">
              <motion.div
                className="h-10 rounded-full bg-[#0e6961]"
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 90, damping: 16 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RevealScene({ step, joinUrl, poll3, poll3Options }: RevealSceneProps) {
  const { tally, total } = usePollResults(poll3?.id ?? null);
  const winner = poll3Options
    .map((o) => ({ ...o, count: tally[o.id] ?? 0 }))
    .sort((a, b) => b.count - a.count)[0];
  const winnerPct = winner && total > 0 ? Math.round((winner.count / total) * 100) : 0;

  if (step === 0) {
    return (
      <div className="flex w-full flex-col items-center text-center">
        <p className="text-2xl uppercase tracking-widest text-[#4a5f59]">You said</p>
        {winner && (
          <h2
            className="mt-4 text-6xl font-medium text-[#0e6961]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {winnerPct}% said {winner.label}
          </h2>
        )}
        {poll3 && (
          <PollResultBars options={poll3Options} tally={tally} total={total} />
        )}
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[#10241f]">
        <motion.h2
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="text-center text-7xl font-medium text-[#4fd8b8]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          This whole screen is a Fabric App.
        </motion.h2>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="flex h-full w-full items-center justify-center gap-16 bg-[#10241f] px-16">
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-2xl bg-white p-4">
            <QRCodeSVG value={joinUrl} size={140} fgColor="#10241f" />
          </div>
          <p className="text-xl text-[#8fe0f5]">No account needed to scan this</p>
        </div>

        <div className="flex flex-1 flex-col items-center gap-4">
          {poll3 && <PollResultBars options={poll3Options} tally={tally} total={total} />}
          <p className="text-xl text-[#8fe0f5]">A GraphQL query, polled every 2 seconds</p>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="rounded-xl bg-black px-6 py-4 font-mono text-lg text-[#4fd8b8]">
            <span className="text-white">$</span> rayfin up
            <br />
            <span className="text-[#8fe0f5]">{joinUrl.replace(/^https?:\/\//, '').replace(/\/join$/, '')}</span>
          </div>
          <p className="text-xl text-[#8fe0f5]">Deployed, right now, to that URL</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center">
      <HubDiagram size={620} showAppsRing />
      <p className="mt-6 text-3xl font-medium text-[#0e6961]" style={{ fontFamily: 'var(--font-display)' }}>
        This app.
      </p>
    </div>
  );
}
