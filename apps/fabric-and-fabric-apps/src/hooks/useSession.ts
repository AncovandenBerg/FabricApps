import { useState } from 'react';

import { getSession, type SessionState } from '@/services/session';

import { usePolling } from './usePolling';

export function useSession(intervalMs = 2000) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);

  usePolling(async () => {
    try {
      const current = await getSession();
      setSession(current);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    }
  }, intervalMs);

  return { session, error };
}
