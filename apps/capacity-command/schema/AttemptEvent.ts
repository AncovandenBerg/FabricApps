import {
  entity,
  anonymous,
  authenticated,
  uuid,
  text,
  int,
  boolean,
  date,
  one,
} from '@microsoft/rayfin-core';

import { Session } from './Session.js';

// One row per decision. Append-only (no update/delete even for the owner):
// this is the bronze layer of the analytics story. Guests write-only:
// create without read keeps telemetry unbrowsable from a shared link.
@entity()
@anonymous('create')
@authenticated(['create', 'read'], {
  policy: (claims, item) => claims.sub.eq(item.userId),
})
export class AttemptEvent {
  @uuid() id!: string;

  @one(() => Session) session!: Session;

  // Entra subject claim; not a FK, so text rather than uuid
  @text({ max: 100 }) userId!: string;

  // Denormalized on purpose: the analytics notebook reads this table
  // standalone without joins
  @text({ max: 10 }) scenarioCode!: string;
  // Carried on the event so mastery can be sliced per campaign week without
  // joining back to Scenario or Session
  @int({ min: 1, max: 52, default: 1 }) weekNumber!: number;
  @text({ max: 30 }) domain!: string;
  @text({ max: 100 }) objective!: string;
  @text({ max: 5 }) chosenOptionKey!: string;
  @boolean() correct!: boolean;
  @int() cuCost!: number;
  @int() slaDelta!: number;
  // Decision latency between incident shown and option clicked
  @int({ min: 0 }) secondsToDecide!: number;
  @date() createdAt!: Date;
}
