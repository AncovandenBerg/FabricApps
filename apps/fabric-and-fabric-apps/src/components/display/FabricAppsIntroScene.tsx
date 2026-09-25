import { motion } from 'framer-motion';

import { HubDiagram } from './HubDiagram';

export function FabricAppsIntroScene() {
  return (
    <div className="flex w-full items-center gap-20">
      <div className="shrink-0">
        <HubDiagram size={640} showAppsRing />
      </div>
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="flex-1"
      >
        <h2
          className="text-7xl font-medium text-[#0e6961]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Fabric Apps
        </h2>
        <p className="mt-8 text-4xl leading-relaxed text-[#10241f]">
          Everything you've seen so far produces data or insights. Fabric apps gives
          the capability to build the custom applications on that data or that provide data.
          <br />
          <br />
          It gets rid of the argmument 
          <br />
          "<b>But we have an Excel for that</b>"
        </p>
      </motion.div>
    </div>
  );
}
