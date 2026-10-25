import { useEffect, useState } from 'react';
import {
  useAppointmentsPageQuery,
  useLoadAppointmentsPage,
} from '@/api/appointments';
import type { Appointment } from '@/api/types';

// The API is paginated. Home/records must also include older pages: the
// most recent page alone isn't the patient's full history or next visit.
export function useAppointments() {
  const first = useAppointmentsPageQuery(1, {
    refetchOnMountOrArgChange: true,
    pollingInterval: 15000,
  });
  const load = useLoadAppointmentsPage();
  const [items, setItems] = useState<Appointment[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState<unknown>();
  useEffect(() => {
    if (!first.data) return;
    let active = true;
    const initial = first.data;
    setPageError(undefined);
    setLoadingMore(!!initial.nextPage);
    void (async () => {
      const all = [...(initial.items ?? [])];
      let next = initial.nextPage;
      const seen = new Set([1]);
      try {
        while (next && !seen.has(next)) {
          seen.add(next);
          const page = await load(next);
          if (!active) return;
          all.push(...(page.items ?? []));
          next = page.nextPage;
        }
        if (active) setItems([...new Map(all.map(a => [a.id, a])).values()]);
      } catch (error) {
        if (active) setPageError(error);
      } finally {
        if (active) setLoadingMore(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [first.data, first.fulfilledTimeStamp, load]);
  return {
    items,
    isLoading: first.isLoading || loadingMore,
    isFetching: first.isFetching || loadingMore,
    error: first.error ?? pageError,
    refetch: first.refetch,
  };
}
