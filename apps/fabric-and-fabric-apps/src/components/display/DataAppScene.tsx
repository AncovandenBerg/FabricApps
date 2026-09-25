const PARTS = [
  {
    title: 'Data package',
    body: 'Endpoint connection, query retries, caching. Handled, not hand-rolled.',
  },
  {
    title: 'Visual package',
    body: 'React and Vega-based charts tuned by the Power BI team.',
  },
  {
    title: 'Agent Skills',
    body: 'Teaches the coding agent to build something with taste (subjective), not just something that renders.',
  },
];

export function DataAppScene() {
  return (
    <div className="w-full max-w-6xl">
      <h2
        className="text-6xl font-medium text-[#0e6961]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        It already knows your semantic model
      </h2>

      <p className="mt-6 max-w-4xl text-3xl leading-relaxed text-[#10241f]">
        Everything so far has been the CRUD side: new tables, new forms. Fabric Apps also
        ships a second template, built with the Power BI team, that starts from a semantic
        model you already have. No new copy of the data. No metrics defined twice.
      </p>

      <div className="mt-10 grid grid-cols-3 gap-6">
        {PARTS.map((part) => (
          <div key={part.title} className="rounded-3xl border border-[#dceae6] bg-white p-8">
            <p className="text-2xl font-medium text-[#10241f]">{part.title}</p>
            <p className="mt-3 text-xl leading-snug text-[#4a5f59]">{part.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-10 text-2xl leading-relaxed text-[#4a5f59]">
        This replaces the restrictions we have on custom visuals, no need for development of custom visuals in Power BI. But visuals developed for customer needs.
      </p>
    </div>
  );
}
