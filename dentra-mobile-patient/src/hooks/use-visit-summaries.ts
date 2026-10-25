import { useEffect, useState } from 'react';
import { useLoadConsultation } from '@/api/appointments';
import type { Appointment, Consultation } from '@/api/types';

export function useVisitSummaries(appointments: Appointment[]) {
  const load = useLoadConsultation();
  const [summaries, setSummaries] = useState<Record<string, Consultation>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const visits = appointments.filter(a => a.status === 'completed' && a.id);
    if (!visits.length) {
      setSummaries({});
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    void Promise.all(visits.map(async a => [a.id!, await load(a.id!)] as const))
      .then(results => {
        if (active) setSummaries(Object.fromEntries(results));
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [appointments, load]);
  return { summaries, loading, error };
}
