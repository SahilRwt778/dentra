import { PortalLayout } from '@/components/portal-layout';
import { NavLink, Outlet } from 'react-router-dom';
import { Toothbrush, WalletCards, Home, CalendarDays, Users, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '@/auth/auth-context';
import { useGetAppointmentsQuery, useGetDentistsMeQuery } from '@/api/generated-api';
import { todayIso, initials } from '@/lib/date';
import { NotificationBell } from '@/components/notification-bell';
import { VideoCallProvider } from '@/components/video-call-provider';

const NAV_ITEMS = [
  { to: '/', label: 'Today', icon: Home, end: true },
  { to: '/schedule', label: 'Schedule', icon: CalendarDays, end: false },
  { to: '/patients', label: 'Patients', icon: Users, end: false },
  { to: '/payments', label: 'Payments', icon: WalletCards, end: false },
  { to: '/wallet', label: 'Wallet', icon: WalletCards, end: false },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, end: false },
];

export function AppShell() {
  const { logout } = useAuth();
  const { data: me } = useGetDentistsMeQuery();
  const { data: todayAppointments } = useGetAppointmentsQuery({
    date: todayIso(),
  });
  const waitingCount = todayAppointments?.items?.filter((a) => a.status === 'waiting').length ?? 0;

  return (
    <VideoCallProvider>
      <div className="po">
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
                {to === '/' && waitingCount > 0 && <span className="count">{waitingCount}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="po-user">
            <div className="row">
              <div className="avatar">{initials(me?.fullName)}</div>
              <div className="grow">
                <b className="small">{me?.fullName}</b>
                <div className="tiny muted">{me?.clinics?.[0]?.name ?? 'Dentra'}</div>
              </div>
            </div>
            <button className="btn btn-block" style={{ marginTop: 12 }} onClick={logout}>
              Log out
            </button>
          </div>
        </aside>
        <PortalLayout notifications={me?.id && <NotificationBell key={me.id} />}>
          <Outlet />
        </PortalLayout>
      </div>
    </VideoCallProvider>
  );
}
