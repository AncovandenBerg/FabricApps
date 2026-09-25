import { AnimatePresence, motion } from 'framer-motion';

import { WORKLOADS } from '@/content/workloads';

import { HubDiagram } from './HubDiagram';

export function WorkloadZoomScene({ workloadIndex }: { workloadIndex: number }) {
  const index = workloadIndex % WORKLOADS.length;
  const workload = WORKLOADS[index];

  return (
    <div className="flex w-full items-center gap-16">
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="shrink-0"
      >
        <HubDiagram size={640} highlightIndex={index} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="flex-1"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={workload.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
          >
            <h3
              className="text-6xl font-medium text-[#0e6961]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {workload.name}
            </h3>
            <p className="mt-6 text-4xl leading-relaxed text-[#10241f]">
              {workload.description}
            </p>
            <p className="mt-10 text-2xl uppercase tracking-widest text-[#4a5f59]">
              Used for
            </p>
            <ul className="mt-4 space-y-4">
              {workload.useCases.map((useCase) => (
                <li key={useCase} className="flex items-start gap-4 text-3xl text-[#10241f]">
                  <span className="mt-3.5 h-3 w-3 shrink-0 rounded-sm bg-[#4fd8b8]" />
                  {useCase}
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
