import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  dentraApi,
  useGetNotificationsQuery,
  usePatchNotificationsByNotificationIdReadMutation,
  usePostNotificationsReadAllMutation,
  type DentistOnboardingNotification,
  type WithdrawalNotification,
  type Notification,
} from '@/api/generated-api';
import { useAppDispatch } from '@/store/hooks';

type AdminNotice = DentistOnboardingNotification | WithdrawalNotification;
function onboardingDescription(notification: AdminNotice) {
  if (notification.type === 'wallet_withdrawal_requested') return `${notification.dentistName} requested ₹${(notification.amountPaise/100).toFixed(2)} from their wallet.`;
  return `${notification.dentistName} (${notification.qualification}, ${notification.specialization}) submitted an onboarding request.`;
}

export function NotificationBell() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const panelId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const seen = useRef(new Set<string>());
  const initialized = useRef(false);
  const [open, setOpen] = useState(false);
  const [olderItems, setOlderItems] = useState<Notification[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null>();
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState(false);
  const { data, error, isFetching, refetch } = useGetNotificationsQuery(
    {},
    {
      pollingInterval: 5000,
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
      refetchOnReconnect: true,
      skipPollingIfUnfocused: true,
    },
  );
  const [markRead] = usePatchNotificationsByNotificationIdReadMutation();
  const [markAllRead, { isLoading: markingAll }] = usePostNotificationsReadAllMutation();
  const unread = data?.unreadCount ?? 0;
  const nextCursor = olderCursor === undefined ? data?.nextCursor : olderCursor;
  const items = [...new Map([...olderItems, ...(data?.items ?? [])].map((item) => [item.id, item])).values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .filter((item): item is AdminNotice => (item.type === 'dentist_onboarding_submitted' || item.type === 'wallet_withdrawal_requested'));

  const openApplication = useCallback(
    (notification: AdminNotice) => {
      setOpen(false);
      navigate(notification.type === 'wallet_withdrawal_requested' ? `/withdrawals/${notification.withdrawalId}` : `/dentists/review?dentistId=${notification.dentistId}`);
      if (!notification.readAt) {
        void markRead({ notificationId: notification.id })
          .unwrap()
          .then((updated) => {
            setOlderItems((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
          })
          .catch(() => toast.error('The application opened, but its notification could not be marked read.'));
      }
    },
    [markRead, navigate],
  );

  useEffect(() => {
    if (!data || error) return;
    const newRequests = initialized.current
      ? data.items.filter(
          (item): item is AdminNotice =>
            (item.type === 'dentist_onboarding_submitted' || item.type === 'wallet_withdrawal_requested') && !seen.current.has(item.id),
        )
      : [];
    data.items.forEach((item) => seen.current.add(item.id));
    initialized.current = true;
    if (!newRequests.length) return;
    // Refresh the review queue and its sidebar count along with the inbox.
    dispatch(dentraApi.util.invalidateTags(['Admin','Wallet']));
    if (newRequests.length === 1) {
      toast(newRequests[0].type === 'wallet_withdrawal_requested' ? 'New withdrawal request' : 'New dentist onboarding request', {
        className: 'notification-toast',
        id: `onboarding-${newRequests[0].id}`,
        description: onboardingDescription(newRequests[0]),
        duration: 8000,
        action: { label: 'Review', onClick: () => openApplication(newRequests[0]) },
      });
    } else {
      toast('New admin requests', {
        className: 'notification-toast',
        description: 'Open notifications to review the latest requests.',
        duration: 8000,
      });
    }
  }, [data, error, dispatch, openApplication]);

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  async function loadOlder() {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    setOlderError(false);
    try {
      const page = await dispatch(
        dentraApi.endpoints.getNotifications.initiate({ cursor: nextCursor }, { subscribe: false, forceRefetch: true }),
      ).unwrap();
      setOlderItems((previous) => [
        ...new Map([...previous, ...(data?.items ?? []), ...page.items].map((item) => [item.id, item])).values(),
      ]);
      setOlderCursor(page.nextCursor);
    } catch {
      setOlderError(true);
    } finally {
      setLoadingOlder(false);
    }
  }

  async function readAll() {
    if (!data?.items[0]) return;
    try {
      await markAllRead({ body: { through: data.items[0].id } }).unwrap();
      setOlderItems((previous) =>
        previous.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })),
      );
    } catch {
      toast.error('Could not mark notifications read. Please try again.');
    }
  }

  return (
    <div
      className="notification-bell"
      ref={wrapper}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        type="button"
        ref={trigger}
        className="notification-trigger"
        aria-label={`Notifications, ${unread} unread`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((previous) => !previous)}
      >
        <Bell size={20} />
        {unread > 0 && <span className="notification-count">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <section className="notification-panel" id={panelId} aria-label="Admin notifications">
          <div className="notification-heading row between">
            <div>
              <h2>Notifications</h2>
              <p className="tiny muted">{unread} unread</p>
            </div>
            <button type="button" className="btn" aria-label="Close notifications" onClick={close}>
              <X size={16} />
            </button>
          </div>
          <div className="notification-body">
            {error ? (
              <div className="notification-state" role="alert">
                <p>Could not load notifications.</p>
                <button type="button" className="btn" disabled={isFetching} onClick={() => refetch()}>
                  Try again
                </button>
              </div>
            ) : !data ? (
              <p className="notification-state muted" role="status">
                Loading notifications…
              </p>
            ) : items.length === 0 ? (
              <div className="notification-state">
                <p>No notifications yet.</p>
                <p className="small muted">Dentist applications and withdrawal requests will appear here.</p>
              </div>
            ) : (
              <ul className="notification-list">
                {items.map((item) => (
                  <li key={item.id} className={item.readAt ? '' : 'notification-unread'}>
                    <button type="button" className="notification-item" onClick={() => openApplication(item)}>
                      <span className="row between">
                        <b>{item.type === 'wallet_withdrawal_requested' ? 'Wallet withdrawal request' : 'Dentist onboarding request'}</b>
                        {!item.readAt && <span className="badge teal">Unread</span>}
                      </span>
                      <span>{onboardingDescription(item)}</span>
                      <time className="tiny muted" dateTime={item.createdAt}>
                        {new Date(item.createdAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </time>
                      <span className="small notification-open">{item.type === 'wallet_withdrawal_requested' ? 'Review withdrawal →' : 'Review application →'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {olderError && (
              <p className="notification-state small" role="alert">
                Could not load older notifications. Please try again.
              </p>
            )}
          </div>
          {data && !error && items.length > 0 && (
            <div className="notification-footer row between wrap">
              <button
                type="button"
                className="btn btn-link"
                disabled={!unread || markingAll || loadingOlder}
                onClick={readAll}
              >
                {markingAll ? 'Marking read…' : 'Mark all as read'}
              </button>
              {nextCursor && (
                <button type="button" className="btn" disabled={loadingOlder || markingAll} onClick={loadOlder}>
                  {loadingOlder ? 'Loading…' : 'Load older'}
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
