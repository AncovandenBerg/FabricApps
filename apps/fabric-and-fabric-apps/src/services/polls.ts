import { getRayfinClient } from './rayfinClient';

export interface PollRow {
  id: string;
  question: string;
  stageKey: string;
  order: number;
}

export interface PollOptionRow {
  id: string;
  label: string;
  order: number;
}

export interface PollResponseRow {
  id: string;
  name: string;
  createdAt: Date;
}

export async function getPolls(): Promise<PollRow[]> {
  const client = getRayfinClient();
  const polls = await client.data.Poll.select([
    'id',
    'question',
    'stageKey',
    'order',
  ])
    .orderBy({ order: 'asc' })
    .execute();
  return polls as unknown as PollRow[];
}

export async function getPollOptions(pollId: string): Promise<PollOptionRow[]> {
  const client = getRayfinClient();
  // `poll_id` is the generated FK column, not a declared TS field on PollOption,
  // and a query with no explicit .select() only ever returns `id` — both the
  // filter and the field list need an `any` escape hatch here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options = await (client.data.PollOption as any)
    .select(['id', 'label', 'order'])
    .where({ poll_id: { eq: pollId } })
    .execute();
  return (options as PollOptionRow[]).sort((a, b) => a.order - b.order);
}

export async function getResponses(
  pollId: string
): Promise<Array<PollResponseRow & { option_id: string }>> {
  const client = getRayfinClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const responses = await (client.data.PollResponse as any)
    .select(['id', 'name', 'createdAt', 'option_id'])
    .where({ poll_id: { eq: pollId } })
    .execute();
  return responses as Array<PollResponseRow & { option_id: string }>;
}

export async function submitResponse(
  pollId: string,
  optionId: string,
  name: string
): Promise<void> {
  const client = getRayfinClient();
  await client.data.PollResponse.create({
    poll: { id: pollId },
    option: { id: optionId },
    name,
    createdAt: new Date(),
  } as never);
}

export async function createPoll(
  id: string,
  question: string,
  stageKey: string,
  order: number
): Promise<void> {
  const client = getRayfinClient();
  await client.data.Poll.create({ id, question, stageKey, order } as never);
}

export async function createPollOption(
  id: string,
  pollId: string,
  label: string,
  order: number
): Promise<void> {
  const client = getRayfinClient();
  await client.data.PollOption.create({
    id,
    poll: { id: pollId },
    label,
    order,
  } as never);
}

export async function updatePoll(
  id: string,
  question: string,
  stageKey: string,
  order: number
): Promise<void> {
  const client = getRayfinClient();
  await client.data.Poll.update({ id } as never, { question, stageKey, order } as never);
}

export async function updatePollOption(
  id: string,
  label: string,
  order: number
): Promise<void> {
  const client = getRayfinClient();
  await client.data.PollOption.update({ id } as never, { label, order } as never);
}

export async function deletePoll(id: string): Promise<void> {
  const client = getRayfinClient();
  await client.data.Poll.delete({ id } as never);
}

export async function deletePollOption(id: string): Promise<void> {
  const client = getRayfinClient();
  await client.data.PollOption.delete({ id } as never);
}
