const SOLID_TODAY = [
  'Auth, schema, GraphQL API, OneLake landing',
  'Anonymous data access (what just ran the poll)',
  'Fabric SSO in production',
  'OneLake-native data',
];

const NOT_YET = [
  'RBAC beyond authenticated and anonymous. You write the policy logic yourself.',
  'Push and subscriptions. That bar chart is polling GraphQL every 2 seconds, not subscribing.',
  "OIDC, social login, B2B/B2C scenarios. Later this year, per Microsoft's roadmap.",
  "Broader external connectors aren't here yet.",
];

export function PreviewStatusScene() {
  return (
    <div className="w-full max-w-6xl">
      <h2
        className="text-6xl font-medium text-[#0e6961]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Still a preview feature
      </h2>

      <p className="mt-6 max-w-4xl text-3xl leading-relaxed text-[#10241f]">
        Everything you just saw is real, and it shipped in 2026. It's about four
        months old. 
      </p>

      <div className="mt-10 grid grid-cols-2 gap-8">
        <div className="rounded-3xl border border-[#dceae6] bg-white p-8">
          <p className="text-sm uppercase tracking-widest text-[#4a5f59]">Solid today</p>
          <ul className="mt-4 space-y-3">
            {SOLID_TODAY.map((item) => (
              <li key={item} className="text-2xl leading-snug text-[#10241f]">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border-2 border-[#0e6961] bg-[#eef8f6] p-8">
          <p className="text-sm uppercase tracking-widest text-[#4a5f59]">Not yet</p>
          <ul className="mt-4 space-y-3">
            {NOT_YET.map((item) => (
              <li key={item} className="text-2xl leading-snug text-[#10241f]">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-10 rounded-2xl border border-[#dceae6] bg-white p-8">
        <p className="text-2xl leading-relaxed text-[#10241f]">
          The anonymous write you just used to vote needs three separate opt-ins: tenant,
          app, entity. Never put personal or other sensitive data behind that role, since the API is reachable directly, not just
          through your UI.
        </p>
      </div>

      <p className="mt-8 text-2xl font-medium text-[#0e6961]">
        It is still a preview feature, but first use cases are defined and a co-creation is started.
      </p>
    </div>
  );
}
