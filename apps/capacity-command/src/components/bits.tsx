// Small shared UI pieces from the mockups: the shape-encoded domain dot,
// the progress ring, and the line icons used across screens.
import { domainMeta } from '@/game/domains';

/** Domain identity dot: filled / outline / donut, all in the accent color. */
export function DomainDot({ domain, size = 8 }: { domain: string; size?: number }) {
  const { glyph, short } = domainMeta(domain);
  const base: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    display: 'inline-block',
    flex: 'none',
    boxSizing: 'border-box',
  };
  const style: React.CSSProperties =
    glyph === 'filled'
      ? { ...base, background: 'var(--color-accent)' }
      : glyph === 'outline'
        ? { ...base, border: '1.6px solid var(--color-accent)' }
        : {
            ...base,
            background: 'var(--color-accent)',
            boxShadow: 'inset 0 0 0 2.2px var(--color-bg)',
          };
  return <span style={style} role="img" aria-label={short} />;
}

interface RingProps {
  /** 0..100 */
  percent: number;
  size: number;
  strokeWidth: number;
  value: string;
  caption: string;
}

/** Circular progress ring with a big display-serif value in the center. */
export function Ring({ percent, size, strokeWidth, value, caption }: RingProps) {
  const r = size / 2 - strokeWidth - 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--color-track)" strokeWidth={strokeWidth} />
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${c} ${c})`}
      />
      <text
        x={c}
        y={c + size * 0.02}
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontWeight="600"
        fontSize={size * 0.3}
        fill="var(--color-ink)"
      >
        {value}
      </text>
      <text
        x={c}
        y={c + size * 0.17}
        textAnchor="middle"
        fontFamily="var(--font-sans)"
        fontSize={Math.max(7, size * 0.062)}
        letterSpacing="1.5"
        fill="var(--color-mute)"
      >
        {caption}
      </text>
    </svg>
  );
}

type IconProps = { size?: number; className?: string };

function icon(path: React.ReactNode, viewBox = '0 0 24 24') {
  return function Icon({ size = 22, className }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
      >
        {path}
      </svg>
    );
  };
}

export const IconHome = icon(
  <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
);
export const IconMap = icon(<path d="M3 12h4l3 8 4-16 3 8h4" />);
export const IconStats = icon(
  <>
    <path d="M3 3v18h18" />
    <rect x="7" y="10" width="3" height="7" />
    <rect x="14" y="6" width="3" height="11" />
  </>
);
export const IconUser = icon(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </>
);
export const IconChevron = icon(<path d="m9 18 6-6-6-6" />);
export const IconBack = icon(<path d="m15 18-6-6 6-6" />);
export const IconCheck = icon(<path d="M20 6 9 17l-5-5" />);
export const IconLock = icon(
  <>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>
);
export const IconAlert = icon(
  <>
    <path d="M10.3 3.9 2.4 17.5a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </>
);

export function IconPlay({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
