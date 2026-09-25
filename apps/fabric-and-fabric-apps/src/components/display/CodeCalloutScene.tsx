// This is our actual rayfin/data/PollResponse.ts — the poll you're about to
// vote on runs through exactly this model. Kept as a literal string so what's
// on screen is verifiably the real file, not an illustration.
const CODE = `@entity()
@role('anonymous', ['create', 'read'])
@role('authenticated', 'read')
export class PollResponse {
  @uuid() id!: string;
  @one(() => Poll) poll!: Poll;
  @one(() => PollOption) option!: PollOption;
  @text({ min: 1, max: 60 }) name!: string;
  @date() createdAt!: Date;
}`;

const CALLOUTS = [
  {
    title: 'Code-first, git-first',
    body: 'The whole app is a repository. Review it, branch it, let an agent edit it. No designer canvas to click through.',
  },
  {
    title: 'The model is the contract',
    body: 'Decorators generate the table, the API, and the auth rules. Change a field once, everything follows.',
  },
  {
    title: 'Bring your own frontend',
    body: 'This screen is React, Vite, Tailwind, and framer-motion. Fabric imposes no UI kit and no chrome.',
  },
];

export function CodeCalloutScene() {
  return (
    <div className="flex w-full max-w-6xl items-start gap-16">
      <div className="flex-1">
        <h2
          className="text-6xl font-medium text-[#0e6961]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Why developers care
        </h2>
        <pre className="mt-8 overflow-hidden rounded-2xl bg-[#10241f] p-8 text-2xl leading-relaxed text-[#eef8f6]">
          <code>{CODE}</code>
        </pre>
      </div>

      <div className="w-[420px] shrink-0 space-y-8 pt-24">
        {CALLOUTS.map((c) => (
          <div key={c.title}>
            <p className="text-2xl font-medium text-[#10241f]">{c.title}</p>
            <p className="mt-2 text-xl leading-snug text-[#4a5f59]">{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
