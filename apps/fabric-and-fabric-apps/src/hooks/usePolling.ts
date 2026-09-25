import { useEffect, useRef } from 'react';

/**
 * Repeatedly calls `fn` on `intervalMs`, starting immediately. There's no
 * push/subscription support in the Rayfin GraphQL API, so this is the one
 * mechanism every "live" screen (Session state, poll tallies) is built on.
 */
export function usePolling(
  fn: () => void | Promise<void>,
  intervalMs: number,
  deps: unknown[] = []
): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (!cancelled) await fnRef.current();
    };

    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // fn is read via fnRef so it can change every render without resetting the interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);
}
