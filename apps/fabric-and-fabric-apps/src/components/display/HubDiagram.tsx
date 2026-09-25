import { motion } from 'framer-motion';
import FabricLogo from '@fabric-msft/svg-icons/Fabric48Color';

import { WORKLOADS } from '@/content/workloads';

interface HubDiagramProps {
  /** Index of the workload to bring forward (dims the rest). Omit to show all at full presence. */
  highlightIndex?: number;
  size?: number;
  /** Draws the dashed "Fabric Apps" ring wrapping every workload — the cross-cutting-layer visual. */
  showAppsRing?: boolean;
  /** When provided, workload badges become clickable and this fires with the clicked index. */
  onSelect?: (index: number) => void;
  /** When provided, the center Fabric badge (and the Apps ring, if shown) become clickable — typically "zoom back out". */
  onSelectCenter?: () => void;
}

const LABEL_FONT_SIZE = 26;
const LABEL_LINE_HEIGHT = 1.2;
const HUB_LABEL_FONT_SIZE = 32;
/** Half the rendered height of the two-line "Fabric Apps" pill — used only to keep top/bottom whitespace balanced. */
const APPS_PILL_HALF_HEIGHT = 40;
const VERTICAL_PAD = 24;

export function HubDiagram({
  highlightIndex,
  size = 640,
  showAppsRing = false,
  onSelect,
  onSelectCenter,
}: HubDiagramProps) {
  const radius = size * 0.4;
  const appsRingRadius = radius * 1.45;
  const center = size / 2;
  const badgeSize = size * 0.135;
  const hubBadgeSize = size * 0.2;
  const labelWidth = size * 0.24;
  const labelBoxHeight = LABEL_FONT_SIZE * LABEL_LINE_HEIGHT * 2;
  const interactive = Boolean(onSelect);
  const canvasWidth = showAppsRing ? size + (appsRingRadius - radius) * 2 + 40 : size;
  const offsetX = (canvasWidth - size) / 2;

  // Vertical extent of everything actually drawn, in the diagram's local (untranslated)
  // coordinate space — the ring/pill only stick out above, and workload labels only stick
  // out below, so wrapping the canvas around these exact bounds (instead of reusing the
  // ring's horizontal padding for height too) is what keeps top and bottom whitespace equal.
  const topContentY = showAppsRing
    ? Math.min(center - appsRingRadius - APPS_PILL_HALF_HEIGHT, center - radius - badgeSize / 2)
    : center - radius - badgeSize / 2;
  const bottomContentY = Math.max(
    center + radius + badgeSize / 2 + 10 + labelBoxHeight,
    showAppsRing ? center + appsRingRadius : -Infinity
  );
  const canvasHeight = bottomContentY - topContentY + VERTICAL_PAD * 2;
  const offsetY = VERTICAL_PAD - topContentY;

  const positions = WORKLOADS.map((_, index) => {
    const angle = (2 * Math.PI * index) / WORKLOADS.length - Math.PI / 2;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    };
  });

  return (
    <div className="relative mx-auto" style={{ width: canvasWidth, height: canvasHeight }}>
      <div className="absolute" style={{ left: offsetX, top: offsetY }}>
        <svg
          className="absolute inset-0"
          width={size}
          height={size}
          aria-hidden="true"
          style={{ overflow: 'visible' }}
        >
          {showAppsRing && (
            <motion.circle
              cx={center}
              cy={center}
              r={appsRingRadius}
              fill="none"
              stroke="#0e6961"
              strokeWidth={2.5}
              strokeDasharray="10 8"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 0.8, scale: 1 }}
              transition={{ duration: 0.6 }}
              style={{ transformOrigin: `${center}px ${center}px` }}
            />
          )}
          {positions.map((pos, index) => {
            const isHighlighted = highlightIndex === index;
            return (
              <motion.line
                key={WORKLOADS[index].id}
                x1={center}
                y1={center}
                x2={pos.x}
                y2={pos.y}
                stroke="#0e6961"
                strokeWidth={isHighlighted ? 4 : 3}
                animate={{
                  opacity: highlightIndex === undefined ? 0.4 : isHighlighted ? 0.9 : 0.4,
                }}
                transition={{ duration: 0.5 }}
              />
            );
          })}
        </svg>

        {showAppsRing && (
          <button
            type="button"
            disabled={!onSelectCenter}
            onClick={onSelectCenter}
            className="absolute rounded-full border border-[#0e6961] bg-white px-4 py-1.5 font-medium text-[#0e6961]"
            style={{
              left: center,
              top: center - appsRingRadius,
              transform: 'translate(-50%, -50%)',
              fontSize: 22,
              fontFamily: 'var(--font-display)',
              cursor: onSelectCenter ? 'pointer' : 'default',
            }}
          >
            Fabric Apps
          </button>
        )}

        <div
          className="absolute flex flex-col items-center"
          style={{ left: center, top: center, transform: 'translate(-50%, -50%)' }}
        >
          <motion.button
            type="button"
            disabled={!onSelectCenter}
            onClick={onSelectCenter}
            className="flex items-center justify-center rounded-full border border-teal-100 bg-white shadow-lg shadow-teal-900/10"
            style={{
              width: hubBadgeSize,
              height: hubBadgeSize,
              cursor: onSelectCenter ? 'pointer' : 'default',
            }}
            whileHover={onSelectCenter ? { scale: 1.05 } : undefined}
          >
            <FabricLogo width={hubBadgeSize * 0.5} height={hubBadgeSize * 0.5} />
          </motion.button>
          <p
            className="mt-3 whitespace-nowrap font-medium text-[#0e6961]"
            style={{ fontSize: HUB_LABEL_FONT_SIZE, fontFamily: 'var(--font-display)' }}
          >
            Microsoft Fabric
          </p>
        </div>

        {WORKLOADS.map((workload, index) => {
          const pos = positions[index];
          const dimmed = highlightIndex !== undefined && highlightIndex !== index;
          const Icon = workload.Icon;

          return (
            <div
              key={workload.id}
              className="absolute flex flex-col items-center"
              style={{ left: pos.x, top: pos.y, transform: `translate(-50%, -${badgeSize / 2}px)` }}
            >
              <motion.button
                type="button"
                disabled={!interactive}
                onClick={() => onSelect?.(index)}
                className="flex items-center justify-center rounded-full border bg-white"
                style={{
                  width: badgeSize,
                  height: badgeSize,
                  cursor: interactive ? 'pointer' : 'default',
                }}
                animate={{
                  opacity: dimmed ? 0.5 : 1,
                  scale: highlightIndex === index ? 1.1 : 1,
                  borderColor: dimmed ? '#dceae6' : '#4fd8b8',
                  boxShadow:
                    highlightIndex === index
                      ? '0 12px 28px -8px rgba(14, 105, 97, 0.35)'
                      : '0 4px 12px -4px rgba(14, 105, 97, 0.12)',
                }}
                whileHover={
                  interactive ? { scale: (highlightIndex === index ? 1.1 : 1) * 1.05 } : undefined
                }
                transition={{ duration: 0.5 }}
              >
                <Icon width={badgeSize * 0.5} height={badgeSize * 0.5} />
              </motion.button>
              <motion.div
                className="mt-2.5 flex items-center justify-center break-words text-center leading-tight text-[#10241f]"
                style={{ fontSize: LABEL_FONT_SIZE, width: labelWidth, height: labelBoxHeight }}
                animate={{ opacity: dimmed ? 0.5 : 1 }}
                transition={{ duration: 0.5 }}
              >
                {workload.name}
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
