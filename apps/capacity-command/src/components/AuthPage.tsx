import { useState } from 'react';

import { useAuth } from '@/hooks/AuthContext';

const msLogo = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 21 21"
    className="mr-2"
  >
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);

export function AuthPage() {
  const { signIn, continueAsGuest, fabricAuthEnabled } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    setIsLoading(true);

    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  const buttonLabel = isLoading
    ? fabricAuthEnabled
      ? 'Opening Fabric...'
      : 'Signing in...'
    : 'Sign in with Microsoft';

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-bg p-8 shadow-card">
        <div className="text-[10px] uppercase tracking-[0.14em] text-accent">
          Nordwind Logistics · DP-700 prep
        </div>
        <h1 className="mt-2 flex items-center gap-2 font-display text-2xl font-semibold">
          <span className="inline-block h-2 w-2 bg-accent" aria-hidden />
          Capacity Command
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-mute">
          One week. One Fabric capacity. Your call. Sign in to take the
          platform admin shift.
        </p>

        <button
          type="button"
          onClick={handleSignIn}
          disabled={isLoading}
          className="mt-8 flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-deep disabled:opacity-50"
        >
          {msLogo}
          {buttonLabel}
        </button>

        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[10px] uppercase tracking-[0.1em] text-soft">
            or
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <button
          type="button"
          onClick={() => continueAsGuest()}
          disabled={isLoading}
          className="w-full rounded-xl border border-accent px-4 py-3 text-sm font-medium text-accent transition-colors hover:bg-tint disabled:opacity-50"
        >
          Play as guest
        </button>
        <p className="mt-2 text-center text-xs text-soft">
          No account needed. Progress stays in this browser.
        </p>

        {error && <p className="mt-3 text-center text-sm text-bad">{error}</p>}
      </div>
    </div>
  );
}
