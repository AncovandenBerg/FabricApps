import type { AttemptRecord, GameScenario } from '@/game/types';

interface FeedbackPanelProps {
  scenario: GameScenario;
  attempt: AttemptRecord;
  hasFollowUp: boolean;
  onContinue: () => void;
}

export function FeedbackPanel({
  scenario,
  attempt,
  hasFollowUp,
  onContinue,
}: FeedbackPanelProps) {
  const option = scenario.options.find(
    (o) => o.optionKey === attempt.chosenOptionKey
  );

  return (
    <div
      className={`rounded-2xl border bg-surface shadow-card ${
        attempt.correct ? 'border-accent/50' : 'border-bad/50'
      }`}
    >
      <div className="flex items-baseline gap-3 px-4 pt-3.5">
        <span
          className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${
            attempt.correct ? 'text-accent' : 'text-bad'
          }`}
        >
          {attempt.correct ? 'Good call' : 'Not the best move'}
        </span>
        <span className="ml-auto flex gap-4 text-[11px]">
          <span className="text-mute" data-testid="feedback-cu">
            CU cost: <strong className="text-ink">{attempt.cuCost}</strong>
          </span>
          <span className="text-mute" data-testid="feedback-sla">
            SLA:{' '}
            <strong className={attempt.slaDelta < 0 ? 'text-bad' : 'text-accent'}>
              {attempt.slaDelta > 0 ? `+${attempt.slaDelta}` : attempt.slaDelta}
            </strong>
          </span>
        </span>
      </div>

      <div className="px-4 pb-4 pt-2">
        <p className="text-sm leading-relaxed text-ink">{option?.feedback}</p>

        {hasFollowUp && (
          <p className="mt-2.5 rounded-lg bg-bad-tint px-3 py-2 text-xs text-bad">
            This decision has consequences. An incident is coming in.
          </p>
        )}

        <button
          type="button"
          onClick={onContinue}
          className="mt-4 w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-deep"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
