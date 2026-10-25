import React, { useCallback, useEffect, useRef } from 'react';
import { useForegroundRefresh } from '../../common/hooks/useForegroundRefresh';
import { errorMessage } from '../../common/utils/api-error';
import type { DentistNotification } from '../../common/types/api';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { inboxReceived, noticeDismissed } from '../../store/notificationsSlice';
import {
  dentraApi,
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from '../../store/dentraApi';
import { session } from '../auth/session';

/** One foreground poller owns delivery; the cache is shared by the bell and inbox. */
export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  const query = useGetNotificationsQuery();
  const busy = useRef(query.isFetching);
  busy.current = query.isFetching;
  const reload = query.refetch;
  const refreshIfIdle = useCallback(() => {
    if (!busy.current) reload();
  }, [reload]);
  useForegroundRefresh(refreshIfIdle, true, 10000);
  useEffect(() => {
    if (query.currentData && !query.error)
      dispatch(inboxReceived(query.currentData.items));
  }, [dispatch, query.currentData, query.error]);
  const walletVersion = useAppSelector(
    state => state.notifications.walletVersion,
  );
  const appliedWalletVersion = useRef(walletVersion);
  useEffect(() => {
    if (walletVersion !== appliedWalletVersion.current) {
      appliedWalletVersion.current = walletVersion;
      dispatch(dentraApi.util.invalidateTags(['Wallet']));
    }
  }, [dispatch, walletVersion]);
  const notice = useAppSelector(state => state.notifications.notice);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => dispatch(noticeDismissed()), 8000);
    return () => clearTimeout(timer);
  }, [dispatch, notice]);
  return <>{children}</>;
}

export function useNotifications() {
  const query = useGetNotificationsQuery(undefined, {
    refetchOnMountOrArgChange: false,
  });
  const { bookingVersion, notice } = useAppSelector(
    state => state.notifications,
  );
  const dispatch = useAppDispatch();
  const [read, readResult] = useMarkNotificationReadMutation({
    fixedCacheKey: 'read-notification',
  });
  const [readAll, readAllResult] = useMarkAllNotificationsReadMutation({
    fixedCacheKey: 'read-all-notifications',
  });
  const mutationLock = useRef(false);
  async function markRead(item: DentistNotification) {
    if (item.readAt) return;
    if (readAllResult.isError) readAllResult.reset();
    try {
      await read(item.id).unwrap();
    } catch {
      /* The shared mutation error is shown in the inbox. */
    }
  }
  async function markAllRead(through: string) {
    if (mutationLock.current || readAllResult.isLoading) return false;
    mutationLock.current = true;
    if (readResult.isError) readResult.reset();
    const version = session.getVersion();
    try {
      await readAll(through).unwrap();
      return version === session.getVersion();
    } catch {
      return false;
    } finally {
      mutationLock.current = false;
    }
  }
  const actionError = readAllResult.error
    ? errorMessage(readAllResult.error)
    : readResult.error
    ? `Could not mark the notification read. ${errorMessage(readResult.error)}`
    : null;
  return {
    data: query.currentData,
    loading: query.isFetching,
    error: query.error ? errorMessage(query.error) : null,
    reload: query.refetch,
    actionError,
    marking: readAllResult.isLoading,
    markRead,
    markAllRead,
    bookingVersion,
    notice,
    dismissNotice: () => dispatch(noticeDismissed()),
  };
}

export function useBookingUpdates(reload: () => unknown, enabled: boolean) {
  const version = useAppSelector(state => state.notifications.bookingVersion);
  const previous = useRef(version);
  useEffect(() => {
    if (enabled && version !== previous.current) {
      previous.current = version;
      reload();
    }
  }, [enabled, reload, version]);
}
