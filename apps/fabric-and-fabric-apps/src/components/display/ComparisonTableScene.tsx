const ROWS: Array<[string, string, string]> = [
  ['Hosting', 'Provision and pay for a web host', 'The workspace hosts it, you get a URL'],
  [
    'Data',
    'Provision a database, design tables, copy to OneLake later',
    'Declare the model in TypeScript; tables land in OneLake',
  ],
  ['API', 'Write and version REST endpoints by hand', 'A GraphQL API is generated from the model'],
  ['Client', 'Hand-write fetch calls and types', 'A typed client, generated from your own schema'],
  [
    'Auth',
    'App registration, token handling, role mapping',
    'Entra sign-in and workspace roles inherited',
  ],
  ['Deploy', 'Pipelines, templates, environments', 'rayfin up'],
  [
    'Governance',
    'Separate audit, separate lineage',
    'Same workspace permissions and lineage as every other item',
  ],
];

export function ComparisonTableScene() {
  return (
    <div className="w-full max-w-6xl">
      <h2
        className="text-6xl font-medium text-[#0e6961]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        What changes
      </h2>

      <table className="mt-10 w-full border-collapse overflow-hidden rounded-2xl text-left">
        <thead>
          <tr>
            <th className="w-1/5 bg-white px-6 py-4 text-2xl font-medium text-[#4a5f59]" />
            <th className="bg-white px-6 py-4 text-2xl font-medium text-[#4a5f59]">
              Building it yourself
            </th>
            <th className="bg-[#eef8f6] px-6 py-4 text-2xl font-medium text-[#0e6961]">
              As a Fabric App
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([label, before, after], i) => (
            <tr key={label} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fbfdfc]'}>
              <td className="px-6 py-4 text-2xl font-medium text-[#10241f]">{label}</td>
              <td className="px-6 py-4 text-xl leading-snug text-[#4a5f59]">{before}</td>
              <td className="border-l border-[#dceae6] bg-[#eef8f6]/40 px-6 py-4 text-xl leading-snug text-[#10241f]">
                {after === 'rayfin up' ? <code>rayfin up</code> : after}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-8 text-2xl text-[#4a5f59]">
        From an empty folder to a URL in minutes.
      </p>
    </div>
  );
}
