import { useCallback } from 'react';
import {
  useGetNotificationsQuery,
  useLazyGetNotificationsQuery,
  usePatchNotificationsByNotificationIdReadMutation,
  usePostNotificationsReadAllMutation,
} from './generated/patient-api';
import type { QueryOptions } from './types';

export function useNotificationsQuery(options?: QueryOptions) {
  return useGetNotificationsQuery({}, options);
}

export function useLoadNotificationsPage() {
  const [load] = useLazyGetNotificationsQuery();
  return useCallback(
    (cursor: string) => load({ cursor }, false).unwrap(),
    [load],
  );
}

export function useMarkNotificationReadMutation() {
  const [send, state] = usePatchNotificationsByNotificationIdReadMutation();
  const markRead = useCallback(
    (notificationId: string) => send({ notificationId }).unwrap(),
    [send],
  );
  return [markRead, state] as const;
}

export function useMarkAllNotificationsReadMutation() {
  const [send, state] = usePostNotificationsReadAllMutation();
  const markAll = useCallback(
    (through: string) => send({ body: { through } }).unwrap(),
    [send],
  );
  return [markAll, state] as const;
}
