import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';

import { BeforeAfterScene } from '@/components/display/BeforeAfterScene';
import { CodeCalloutScene } from '@/components/display/CodeCalloutScene';
import { ComparisonTableScene } from '@/components/display/ComparisonTableScene';
import { DataAppScene } from '@/components/display/DataAppScene';
import { FabricAppsIntroScene } from '@/components/display/FabricAppsIntroScene';
import { HubDiagram } from '@/components/display/HubDiagram';
import { PreviewStatusScene } from '@/components/display/PreviewStatusScene';
import { ProjectorCanvas } from '@/components/display/ProjectorCanvas';
import { RevealScene } from '@/components/display/RevealScene';
import { WorkloadZoomScene } from '@/components/display/WorkloadZoomScene';
import { useAttendees } from '@/hooks/useAttendees';
import { usePollResults } from '@/hooks/usePollResults';
import { useSession } from '@/hooks/useSession';
import {
  getPollOptions,
  getPolls,
  type PollOptionRow,
  type PollRow,
} from '@/services/polls';

const JOIN_URL = `${import.meta.env.VITE_APP_URL ?? window.location.origin}/join`;

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
  transition: { duration: 0.4, ease: 'easeOut' as const },
};

function StageContent({
  stage,
  workloadIndex,
}: {
  stage: string;
  workloadIndex: number;
}) {
  switch (stage) {
    case 'fabric_overview':
      return (
        <div className="flex flex-col items-center">
          <h2
            className="text-7xl font-medium text-[#10241f]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            All-in-one data analytics platform
          </h2>
          <div className="mt-12">
            <HubDiagram size={860} />
          </div>
        </div>
      );

    case 'workload_zoom':
      return <WorkloadZoomScene workloadIndex={workloadIndex} />;

    case 'fabric_apps_intro':
      return <FabricAppsIntroScene />;

    case 'fabric_apps_background':
      return <BeforeAfterScene />;

    case 'fabric_apps_value':
      return <ComparisonTableScene />;

    case 'fabric_apps_benefits_tech':
      return <CodeCalloutScene />;

    case 'fabric_apps_data_app':
      return <DataAppScene />;

    case 'fabric_apps_preview_status':
      return <PreviewStatusScene />;

    default:
      return null;
  }
}

export function DisplayPage() {
  const { session, error } = useSession();
  const [polls, setPolls] = useState<PollRow[]>([]);
  const [options, setOptions] = useState<PollOptionRow[]>([]);
  const [poll3Options, setPoll3Options] = useState<PollOptionRow[]>([]);
  const activePollId = session?.activePollId || null;
  const { tally, total } = usePollResults(activePollId);
  const attendees = useAttendees(session?.stage === 'lobby');

  useEffect(() => {
    getPolls().then(setPolls).catch(() => setPolls([]));
  }, []);

  useEffect(() => {
    if (!activePollId) {
      setOptions([]);
      return;
    }
    getPollOptions(activePollId).then(setOptions).catch(() => setOptions([]));
  }, [activePollId]);

  const poll3 = polls.find((p) => p.stageKey === 'workload_zoom');

  useEffect(() => {
    if (!poll3) {
      setPoll3Options([]);
      return;
    }
    getPollOptions(poll3.id).then(setPoll3Options).catch(() => setPoll3Options([]));
  }, [poll3]);

  const activePoll = polls.find((p) => p.id === activePollId);
  const ranked = [...options]
    .map((o) => ({ ...o, count: tally[o.id] ?? 0 }))
    .sort((a, b) => b.count - a.count);

  return (
    <ProjectorCanvas>
      <div className="relative flex h-full w-full flex-col bg-[#f6f9f8] font-sans">
        {error && (
          <div className="absolute right-6 top-6 rounded-full bg-red-600 px-4 py-1.5 text-sm text-white">
            Connection issue
          </div>
        )}

        <div className="flex flex-1 items-center justify-center overflow-hidden px-24 py-16">
          <AnimatePresence mode="popLayout">
            {session?.stage === 'lobby' ? (
              <motion.div
                key="lobby"
                {...fadeUp}
                className="flex flex-col items-center gap-10"
              >
                <p
                  className="text-4xl text-[#10241f]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Scan to join
                </p>
                <div className="rounded-3xl border border-[#dceae6] bg-white p-8 shadow-lg shadow-teal-900/5">
                  <QRCodeSVG value={JOIN_URL} size={340} fgColor="#10241f" />
                </div>
                <div className="flex min-h-[64px] max-w-4xl flex-wrap items-center justify-center gap-3">
                  <AnimatePresence>
                    {attendees.map((a) => (
                      <motion.span
                        key={a.id}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 14 }}
                        className="rounded-full border border-[#dceae6] bg-white px-5 py-2 text-2xl text-[#10241f]"
                      >
                        {a.name}
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </div>
                {attendees.length > 0 && (
                  <p className="text-3xl font-medium text-[#0e6961]">
                    {attendees.length} in the room
                  </p>
                )}
              </motion.div>
            ) : session ? (
              <motion.div key={session.stage} {...fadeUp} className="flex w-full justify-center">
                {session.stage === 'reveal' ? (
                  <RevealScene
                    step={session.revealStep}
                    joinUrl={JOIN_URL}
                    poll3={poll3}
                    poll3Options={poll3Options}
                  />
                ) : session.stage === 'wrapup' ? (
                  <div className="flex flex-col items-center">
                    <HubDiagram size={560} showAppsRing />
                    <h2
                      className="mt-8 text-7xl font-medium text-[#10241f]"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      Thank you!
                    </h2>
                    <p className="mt-4 text-4xl text-[#4a5f59]">Questions?</p>
                  </div>
                ) : (
                  <StageContent stage={session.stage} workloadIndex={session.currentWorkloadIndex} />
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {activePollId && activePoll && (
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ duration: 0.4 }}
              className="border-t border-[#dceae6] bg-white px-24 py-10"
            >
              <div className="mx-auto max-w-5xl">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-5xl font-medium text-[#10241f]">{activePoll.question}</h2>
                  <p className="whitespace-nowrap pl-8 text-3xl text-[#4a5f59]">
                    {total} responses
                  </p>
                </div>
                <div className="mt-8 space-y-5">
                  {ranked.map((option, index) => {
                    const pct = total > 0 ? Math.round((option.count / total) * 100) : 0;
                    const color = index === 0 && option.count > 0 ? '#0e6961' : '#4fd8b8';
                    return (
                      <div key={option.id} className="flex items-center gap-6">
                        <span className="w-64 shrink-0 text-2xl text-[#10241f]">
                          {option.label}
                        </span>
                        <div className="relative h-10 flex-1 rounded-full bg-[#eef5f3]">
                          <motion.div
                            className="flex h-10 items-center justify-end rounded-full pr-4"
                            style={{ backgroundColor: color }}
                            animate={{ width: `${Math.max(pct, 6)}%` }}
                            transition={{ type: 'spring', stiffness: 90, damping: 16 }}
                          >
                            <span className="text-lg font-medium text-white">{pct}%</span>
                          </motion.div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ProjectorCanvas>
  );
}
