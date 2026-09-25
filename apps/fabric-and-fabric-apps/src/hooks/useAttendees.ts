import { useState } from 'react';

import { getAttendees, type AttendeeRow } from '@/services/attendees';

import { usePolling } from './usePolling';

export function useAttendees(enabled: boolean, intervalMs = 2000) {
  const [attendees, setAttendees] = useState<AttendeeRow[]>([]);

  usePolling(
    async () => {
      if (!enabled) return;
      const rows = await getAttendees();
      setAttendees(rows);
    },
    intervalMs,
    [enabled]
  );

  return attendees;
}
