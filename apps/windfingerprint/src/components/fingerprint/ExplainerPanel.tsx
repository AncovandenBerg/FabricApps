import { POLLUTANT_INFO } from '@/lib/windFingerprint/pollutants';
import type { Pollutant } from '@/lib/windFingerprint/types';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-medium text-ink">{title}</p>
      <p className="mt-1">{children}</p>
    </div>
  );
}

/** Plain-language, always-visible companion to the charts -- no acronyms, no stats jargon. */
export function ExplainerPanel({ pollutant }: { pollutant: Pollutant }) {
  const info = POLLUTANT_INFO[pollutant];

  return (
    <div className="flex flex-col gap-5 rounded-sm border border-ink/10 bg-panel p-5 text-sm text-ink-soft">
      <div>
        <h2 className="font-display text-sm font-semibold text-ink">What am I looking at?</h2>
        <p className="mt-2">
          You're looking at {info.plainName.toLowerCase()} ({pollutant}): {info.source}. Every chart
          below is centred on the monitoring station and split into slices like a compass, one for each
          direction the wind can blow from.
        </p>
      </div>

      <Section title="Left chart: how bad, and when">
        Darker, redder slices near the outer edge mean pollution was higher when the wind blew from that
        direction at that speed. Grey slices just mean there isn't enough data yet to be sure.
      </Section>

      <Section title="Right chart: where it's coming from">
        This one answers the real question. Whichever slice reaches furthest out points toward the
        direction the pollution is most likely coming from.
      </Section>

      <Section title="The map below">
        The same result, drawn over the real streets, so you can see what's actually sitting in that
        direction: a road, a factory, a neighbour.
      </Section>

      <Section title="The slider">
        Drag it to change what counts as "high pollution." Both charts redraw instantly.
      </Section>
    </div>
  );
}
