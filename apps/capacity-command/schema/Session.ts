import {
  entity,
  anonymous,
  authenticated,
  uuid,
  text,
  int,
  boolean,
  date,
  many,
} from '@microsoft/rayfin-core';

import { AttemptEvent } from './AttemptEvent.js';

// Gameplay telemetry: each signed-in player owns their own rows. Guests
// (shared-link play) may create and update sessions but never read them:
// anonymous requests carry no claims, so row-level scoping is impossible.
// Tampering would require guessing another session's GUID.
@entity()
@anonymous(['create', 'update'])
@authenticated(['create', 'read', 'update'], {
  policy: (claims, item) => claims.sub.eq(item.userId),
})
export class Session {
  @uuid() id!: string;

  // Entra subject claim; not a FK, so text rather than uuid
  @text({ max: 100 }) userId!: string;
  @date() startedAt!: Date;
  @date({ optional: true }) completedAt?: Date;

  // Which campaign week this session played; see seed/campaign.json
  @int({ min: 1, max: 52, default: 1 }) weekNumber!: number;

  @int({ min: 0, max: 200, default: 100 }) cuRemaining!: number;
  @int({ min: 0, max: 200, default: 100 }) slaScore!: number;
  @int({ min: 1, max: 31, default: 1 }) currentDay!: number;
  @boolean({ default: false }) completed!: boolean;

  // How the week ended: "completed" or "breached". A run that ran out of
  // capacity still sets completed, because the session did finish; this is
  // what says whether the week was survived. Defaulted so rows written
  // before breaches existed read back as survived, which they were.
  @text({ max: 20, default: 'completed' }) outcome!: string;

  @many(() => AttemptEvent) attempts?: AttemptEvent[];
}
