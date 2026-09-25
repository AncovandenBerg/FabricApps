import { useState } from 'react';

import { useAuth } from '@/hooks/AuthContext';

const msLogo = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 21 21"
    className="mr-2"
  >
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);

function CompassMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="none" stroke="#e8ece8" strokeOpacity="0.35" strokeWidth="1" />
      <path d="M24 8v6M24 34v6M8 24h6M34 24h6" stroke="#e8ece8" strokeOpacity="0.5" strokeWidth="1.2" />
      <path d="M24 13l7 13-7-3.8L17 26z" fill="#b0431a" />
    </svg>
  );
}

export function AuthPage() {
  const { signIn, fabricAuthEnabled } = useAuth();
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-4 font-sans text-paper">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <CompassMark />
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">
            WindFingerprint
          </h1>
          <p className="mt-2 text-sm text-paper/55">
            See which direction your air pollution is really coming from.
          </p>
        </div>

        <div className="rounded-sm border border-paper/15 bg-panel p-6 text-ink">
          <button
            type="button"
            onClick={handleSignIn}
            disabled={isLoading}
            className="flex w-full items-center justify-center rounded-sm bg-rust px-4 py-3 text-sm font-medium text-paper transition-colors hover:bg-rust-dark disabled:opacity-50"
          >
            {msLogo}
            {buttonLabel}
          </button>

          {error && <p className="mt-3 text-center text-sm text-red-700">{error}</p>}
        </div>
      </div>
    </div>
  );
}
