import { useState } from 'react';
import {
  useNotificationsQuery,
  useLoadNotificationsPage,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from '@/api/notifications';
import type { PatientAppointmentNotification } from '@/api/types';
import { isPatientNotification } from '@/lib/notifications';

export function useNotifications() {
  const query = useNotificationsQuery({ refetchOnMountOrArgChange: true });
  const loadPage = useLoadNotificationsPage();
  const [markRead] = useMarkNotificationReadMutation();
  const [markAll, { isLoading: markingAll }] =
    useMarkAllNotificationsReadMutation();
  const [olderItems, setOlderItems] = useState<
    PatientAppointmentNotification[]
  >([]);
  const [cursor, setCursor] = useState<string | null>();
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState(false);
  const [readError, setReadError] = useState(false);
  const latestItems = (query.data?.items ?? []).filter(isPatientNotification);
  const nextCursor = cursor === undefined ? query.data?.nextCursor : cursor;
  const items = [
    ...new Map(
      [...olderItems, ...latestItems].map(item => [item.id, item]),
    ).values(),
  ].sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );

  async function markNotificationRead(id: string) {
    const updated = await markRead(id);
    if (isPatientNotification(updated)) {
      setOlderItems(previous =>
        previous.map(item => (item.id === updated.id ? updated : item)),
      );
    }
  }

  async function loadOlder() {
    if (!nextCursor || loadingOlder || markingAll) return;
    setLoadingOlder(true);
    setOlderError(false);
    try {
      const page = await loadPage(nextCursor);
      setOlderItems(previous => [
        ...new Map(
          [
            ...previous,
            ...latestItems,
            ...page.items.filter(isPatientNotification),
          ].map(item => [item.id, item]),
        ).values(),
      ]);
      setCursor(page.nextCursor);
    } catch {
      setOlderError(true);
    } finally {
      setLoadingOlder(false);
    }
  }

  async function markAllRead() {
    const newest = query.data?.items[0];
    if (!newest || markingAll || loadingOlder) return;
    setReadError(false);
    try {
      // Only mark notifications that existed when the user pressed the button.
      await markAll(newest.id);
      setOlderItems(previous =>
        previous.map(item => ({
          ...item,
          readAt: item.readAt ?? new Date().toISOString(),
        })),
      );
    } catch {
      setReadError(true);
    }
  }

  function refresh() {
    if (loadingOlder || markingAll) return;
    setOlderItems([]);
    setCursor(undefined);
    setOlderError(false);
    query.refetch();
  }

  return {
    items,
    unread: query.data?.unreadCount ?? 0,
    isLoading: query.isLoading || !query.data,
    isFetching: query.isFetching,
    error: query.error,
    nextCursor,
    loadingOlder,
    olderError,
    markingAll,
    readError,
    markNotificationRead,
    markAllRead,
    loadOlder,
    refresh,
  };
}
