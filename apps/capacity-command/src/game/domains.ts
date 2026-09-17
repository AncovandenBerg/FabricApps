// Exam-domain display metadata. Following the mockups, domains share the
// single accent color and are distinguished by dot SHAPE (filled, outline,
// donut), assigned in fixed order. Shape encoding keeps the palette
// colorblind-safe without a second hue.

export type DomainGlyph = 'filled' | 'outline' | 'donut';

export interface DomainMeta {
  label: string;
  short: string;
  glyph: DomainGlyph;
}

const DOMAINS: Record<string, DomainMeta> = {
  'implement-manage': {
    label: 'Implement and manage an analytics solution',
    short: 'Implement & manage',
    glyph: 'filled',
  },
  'ingest-transform': {
    label: 'Ingest and transform data',
    short: 'Ingest & transform',
    glyph: 'outline',
  },
  'monitor-optimize': {
    label: 'Monitor and optimize an analytics solution',
    short: 'Monitor & optimize',
    glyph: 'donut',
  },
};

export function domainMeta(domain: string): DomainMeta {
  return (
    DOMAINS[domain] ?? { label: domain, short: domain, glyph: 'filled' }
  );
}
