import {
  entity,
  anonymous,
  authenticated,
  uuid,
  text,
  int,
  boolean,
  one,
} from '@microsoft/rayfin-core';

import { Scenario } from './Scenario.js';
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
export class ScenarioOption {
  @uuid() id!: string;

  @one(() => Scenario) scenario!: Scenario;

  @text({ max: 5 }) optionKey!: string;
  @text({ max: 500 }) optionText!: string;
  @int({ min: 0, max: 50 }) cuCost!: number;
  @int({ min: -25, max: 25 }) slaDelta!: number;
  @boolean({ default: false }) correct!: boolean;
  @text({ max: 1000 }) feedback!: string;
  // Scenario.code to enqueue when this option is picked
  @text({ optional: true, max: 10 }) followUpCode?: string;
}
