import { useState } from 'react';

import { getResponses } from '@/services/polls';

import { usePolling } from './usePolling';

export function usePollResults(pollId: string | null, intervalMs = 2000) {
  const [tally, setTally] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);

  usePolling(
    async () => {
      if (!pollId) {
        setTally({});
        setTotal(0);
        return;
      }
      const responses = await getResponses(pollId);
      const counts: Record<string, number> = {};
      for (const response of responses) {
        counts[response.option_id] = (counts[response.option_id] ?? 0) + 1;
      }
      setTally(counts);
      setTotal(responses.length);
    },
    intervalMs,
    [pollId]
  );

  return { tally, total };
}
