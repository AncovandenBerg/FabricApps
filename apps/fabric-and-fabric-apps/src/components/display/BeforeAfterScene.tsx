const BEFORE_ITEMS = [
  'App Service or Static Web Apps for hosting',
  "Azure SQL or Cosmos DB for the app's own tables",
  'A hand-written REST API',
  'An Entra app registration and MSAL wiring',
  'A CI/CD pipeline with infrastructure templates',
  'A Data Factory pipeline to copy data back into OneLake',
];

const FACTS = [
  'Announced at Microsoft Build 2026', 'Built on Rayfin, an open-source SDK and CLI',
  'Designed code-first, so an AI coding agent can scaffold and deploy it too',
];

export function BeforeAfterScene() {
  return (
    <div className="w-full max-w-6xl">
      <h2
        className="text-6xl font-medium text-[#0e6961]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        But Why?
      </h2>

      <div className="mt-10 grid grid-cols-[1fr_auto_1fr] items-center gap-8">
        <div className="rounded-3xl border border-[#dceae6] bg-white p-8">
          <p className="text-sm uppercase tracking-widest text-[#4a5f59]">Before</p>
          <ul className="mt-4 space-y-3">
            {BEFORE_ITEMS.map((item) => (
              <li key={item} className="text-2xl leading-snug text-[#10241f]">
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xl text-[#4a5f59]">
            Six service, multiple experts
          </p>
        </div>

        <div
          className="text-5xl font-medium text-[#0e6961]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          →
        </div>

        <div className="flex h-full flex-col justify-center rounded-3xl border-2 border-[#0e6961] bg-[#eef8f6] p-8">
          <p className="text-sm uppercase tracking-widest text-[#4a5f59]">After</p>
          <p className="mt-4 text-3xl font-medium leading-snug text-[#10241f]">
            One Fabric item.
          </p>
          <p className="mt-3 text-2xl leading-snug text-[#10241f]">
            The app's tables are OneLake tables from the first write.
          </p>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-x-10 gap-y-3">
        {FACTS.map((fact) => (
          <p key={fact} className="text-2xl text-[#4a5f59]">
            {fact}
          </p>
        ))}
      </div>
    </div>
  );
}
