import {
  entity,
  anonymous,
  authenticated,
  uuid,
  text,
  int,
  boolean,
  many,
} from '@microsoft/rayfin-core';

import { ScenarioOption } from './ScenarioOption.js';
import { SEED_USER_EMAIL } from './seedUser.js';

// Reference data seeded from scenarios.json. Readable without sign-in so
// the game works from a shared link; only the dedicated seed account may
// write (see seedUser.ts).
@entity()
@anonymous('read')
@authenticated('read')
@authenticated(['create', 'update', 'delete'], {
  policy: (claims) => claims.email.eq(SEED_USER_EMAIL),
})
export class Scenario {
  @uuid() id!: string;

  // Stable business key ("S01", "W2S08F") so the analytics layer can join
  // to content without caring about generated ids
  @text({ unique: true, max: 10 }) code!: string;
  // Campaign week this scenario belongs to; week structure is configured in
  // seed/campaign.json. Defaults to 1 so rows seeded before weeks existed
  // stay valid.
  @int({ min: 1, max: 52, default: 1 }) week!: number;
  // Day within the week. The cap is deliberately loose: campaign.json owns
  // the real per-week day count.
  @int({ min: 1, max: 31 }) day!: number;
  @text({ max: 30 }) domain!: string;
  @text({ max: 100 }) objective!: string;
  @text({ max: 100 }) title!: string;
  @text({ max: 1000 }) incident!: string;
  // Chained incidents are excluded from the normal day queue
  @boolean({ default: false }) isFollowUp!: boolean;

  @many(() => ScenarioOption) options?: ScenarioOption[];
}
