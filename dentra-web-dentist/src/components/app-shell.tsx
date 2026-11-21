import { ProfileAvatar } from '@/components/profile-avatar';
import { PortalLayout } from '@/components/portal-layout';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Toothbrush,
  WalletCards,
  Home,
  CalendarDays,
  MessageCircle,
  Users,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useAuth } from '@/auth/auth-context';
import {
  useGetAppointmentsQuery,
  useGetConsultationCasesQuery,
  useGetDentistsMeQuery,
} from '@/api/generated-api';
import { todayIso } from '@/lib/date';
import { NotificationBell } from '@/components/notification-bell';
import { VideoCallProvider } from '@/components/video-call-provider';

const NAV_ITEMS = [
  { to: '/', label: 'Today', icon: Home, end: true },
  { to: '/schedule', label: 'Schedule', icon: CalendarDays, end: false },
  { to: '/messages', label: 'Messages', icon: MessageCircle, end: false },
  { to: '/patients', label: 'Patients', icon: Users, end: false },
  { to: '/payments', label: 'Payments', icon: WalletCards, end: false },
  { to: '/wallet', label: 'Wallet', icon: WalletCards, end: false },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, end: false },
];

export function AppShell() {
  const { logout } = useAuth();
  const { pathname } = useLocation();
  const messagesPage =
    pathname === '/messages' || pathname.startsWith('/messages/');
  const { data: conversations } = useGetConsultationCasesQuery(
    { page: 1 },
    { pollingInterval: 10000, skipPollingIfUnfocused: true },
  );
  const { data: me } = useGetDentistsMeQuery();
  const { data: todayAppointments } = useGetAppointmentsQuery({
    date: todayIso(),
  });
  const waitingCount =
    todayAppointments?.items?.filter((a) => a.status === 'waiting').length ?? 0;

  return (
    <VideoCallProvider>
      <div className={`po ${messagesPage ? 'po-messages' : ''}`}>
        <aside className="po-side">
          <div className="row between portal-brand-row">
            <div className="brand">
              <Toothbrush />
              Dentra
            </div>
          </div>
          <nav className="po-nav">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => (isActive ? 'on' : '')}
              >
                <Icon size={18} />
                {label}
                {to === '/messages' && !!conversations?.unreadCount && (
                  <span className="count">{conversations.unreadCount}</span>
                )}
                {to === '/' && waitingCount > 0 && (
                  <span className="count">{waitingCount}</span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="po-user">
            <div className="row">
              <ProfileAvatar
                name={me?.fullName || 'Dentist'}
                photoUrl={me?.profilePhotoUrl}
              />
              <div className="grow">
                <b className="small">{me?.fullName}</b>
                <div className="tiny muted">
                  {me?.clinics?.[0]?.name ?? 'Dentra'}
                </div>
              </div>
            </div>
            <button
              className="btn btn-block"
              style={{ marginTop: 12 }}
              onClick={logout}
            >
              Log out
            </button>
          </div>
        </aside>
        <PortalLayout
          notifications={me?.id && <NotificationBell key={me.id} />}
        >
          <Outlet />
        </PortalLayout>
      </div>
    </VideoCallProvider>
  );
}
