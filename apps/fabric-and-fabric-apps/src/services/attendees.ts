import { getRayfinClient } from './rayfinClient';

export interface AttendeeRow {
  id: string;
  name: string;
  joinedAt: Date;
}

export async function createAttendee(name: string): Promise<void> {
  const client = getRayfinClient();
  await client.data.Attendee.create({ name, joinedAt: new Date() });
}

export async function getAttendees(): Promise<AttendeeRow[]> {
  const client = getRayfinClient();
  const rows = await client.data.Attendee.select(['id', 'name', 'joinedAt'])
    .orderBy({ joinedAt: 'asc' })
    .execute();
  return rows as unknown as AttendeeRow[];
}
