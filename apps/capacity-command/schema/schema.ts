import { Scenario } from './Scenario.js';
import { ScenarioOption } from './ScenarioOption.js';
import { Session } from './Session.js';
import { AttemptEvent } from './AttemptEvent.js';

export type CapacityCommandSchema = {
  Scenario: Scenario;
  ScenarioOption: ScenarioOption;
  Session: Session;
  AttemptEvent: AttemptEvent;
};

export const schema = [Scenario, ScenarioOption, Session, AttemptEvent];
