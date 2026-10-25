import { useCallback, useRef } from 'react';
import { useGetVideoStatusQuery } from '../../store/dentraApi';
import { errorMessage } from '../../common/utils/api-error';
import { useForegroundRefresh } from '../../common/hooks/useForegroundRefresh';

export function useVideoAvailability(appointmentId: string) {
  const result = useGetVideoStatusQuery(appointmentId);
  const query = {
    data: result.currentData,
    error: result.error ? errorMessage(result.error) : null,
    loading: result.isFetching,
    reload: result.refetch,
  };
  const loading = useRef(query.loading);
  loading.current = query.loading;
  const reload = query.reload;
  const refreshIfIdle = useCallback(() => {
    if (!loading.current) reload();
  }, [reload]);
  useForegroundRefresh(refreshIfIdle, true, 5000);
  return query;
}
