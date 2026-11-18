import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { apiCache } from '@/api/cache';
import { useNotificationsQuery } from '@/api/notifications';
import { useAppDispatch } from '@/store/hooks';
import type { PushState } from '@/notifications/push-manager';

// Push refreshes this cache on delivery. Poll only as a foreground fallback.
export function useNotificationSync(pushState: PushState) {
  const dispatch = useAppDispatch();
  const [active, setActive] = useState(
    AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive',
  );
  const seen = useRef(new Set<string>());
  const initialized = useRef(false);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state =>
      setActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  const { data, error } = useNotificationsQuery({
    skip: !active,
    pollingInterval: active && pushState !== 'enabled' ? 10000 : 0,
    refetchOnMountOrArgChange: true,
  });
  useEffect(() => {
    if (!data || error) return;
    const changed =
      initialized.current &&
      data.items.some(item => !seen.current.has(item.id));
    data.items.forEach(item => seen.current.add(item.id));
    initialized.current = true;
    if (changed)
      dispatch(
        apiCache.invalidateTags([
          'Appointments',
          'Consultations',
          'Patients',
          'Consultation Cases',
        ]),
      );
  }, [data, error, dispatch]);
}
