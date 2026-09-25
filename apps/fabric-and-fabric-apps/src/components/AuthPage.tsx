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
    <div className="min-h-screen flex items-center justify-center bg-[#f6f9f8] p-4 font-sans">
      <div className="w-full max-w-sm rounded-3xl border border-[#dceae6] bg-white p-8 shadow-lg shadow-teal-900/5">
        <div className="mb-8 text-center">
          <h1
            className="text-3xl font-semibold text-[#10241f]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Presenter Control
          </h1>
          <p className="mt-2 text-sm text-[#10241f]/60">
            Sign in to drive the session.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignIn}
          disabled={isLoading}
          className="flex w-full items-center justify-center rounded-xl bg-[#0e6961] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#177e71] disabled:bg-[#dceae6] disabled:text-[#10241f]/50"
        >
          {msLogo}
          {buttonLabel}
        </button>

        {error && (
          <p className="mt-3 text-center text-sm text-red-600">{error}</p>
        )}
      </div>
    </div>
  );
}
