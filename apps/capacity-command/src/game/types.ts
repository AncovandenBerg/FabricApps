/** Option as consumed by the game UI, mapped from a ScenarioOption row. */
export interface GameOption {
  optionKey: string;
  optionText: string;
  cuCost: number;
  slaDelta: number;
  correct: boolean;
  feedback: string;
  followUpCode: string | null;
}

/** Scenario as consumed by the game UI, mapped from a Scenario row. */
export interface GameScenario {
  code: string;
  /** Campaign week this scenario belongs to; see seed/campaign.json. */
  week: number;
  day: number;
  domain: string;
  objective: string;
  title: string;
  incident: string;
  isFollowUp: boolean;
  options: GameOption[];
}

/** One decision, mirroring the AttemptEvent entity contract. */
export interface AttemptRecord {
  scenarioCode: string;
  /**
   * Campaign week the decision was made in. Denormalized onto the attempt
   * on purpose: mastery can be sliced per week without joining back to the
   * scenario or the session, so the analytics table stays readable alone.
   */
  weekNumber: number;
  domain: string;
  objective: string;
  chosenOptionKey: string;
  correct: boolean;
  cuCost: number;
  slaDelta: number;
  secondsToDecide: number;
}

/** Per-domain result for the end-of-week summary. */
export interface DomainSummary {
  domain: string;
  total: number;
  correct: number;
  /** Correct percentage, 0-100, rounded. */
  percentage: number;
}
