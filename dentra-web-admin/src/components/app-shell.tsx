import { NotificationBell } from '@/components/notification-bell';
import { PortalLayout } from '@/components/portal-layout';
import { NavLink, Outlet, useMatch } from 'react-router-dom';
import {
  Toothbrush,
  Home,
  CalendarDays,
  ClipboardCheck,
  ShieldCheck,
  Receipt,
  Landmark,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useAuth } from '@/auth/auth-context';
import {
  useGetAdminDentistsQuery,
  useGetAdminMeQuery,
  useGetAdminSettingsQuery,
} from '@/api/generated-api';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: Home, end: true },
  {
    to: '/appointments',
    label: 'Appointments',
    icon: CalendarDays,
    end: false,
  },
  {
    to: '/dentists/review',
    label: 'Review Queue',
    icon: ClipboardCheck,
    end: false,
  },
  { to: '/dentists', label: 'Dentists', icon: ShieldCheck, end: true },
  { to: '/payouts', label: 'Payout review', icon: Landmark, end: false },
  { to: '/withdrawals', label: 'Withdrawals', icon: Landmark, end: false },
  { to: '/payments', label: 'Payments', icon: Receipt, end: false },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, end: false },
];

export function AppShell() {
  const { logout } = useAuth();
  const dentistRoute = useMatch('/dentists/:dentistId');
  const viewingDentist =
    !!dentistRoute && dentistRoute.params.dentistId !== 'review';
  const { data } = useGetAdminDentistsQuery({ status: 'pending_review' });
  const { data: profile } = useGetAdminMeQuery();
  const { data: platform } = useGetAdminSettingsQuery();
  const pendingCount = data?.items?.length ?? 0;

  return (
    <div className="po">
      <aside className="po-side">
        <div className="row between">
          <div className="brand">
            <Toothbrush />
            {platform?.name ?? 'Dentra'}
          </div>
        </div>
        <nav className="po-nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                isActive || (to === '/dentists' && viewingDentist) ? 'on' : ''
              }
            >
              <Icon size={18} />
              {label}
              {to === '/dentists/review' && pendingCount > 0 && (
                <span className="count">{pendingCount}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="po-user">
          <div className="row">
            <div className="avatar">
              {profile?.name.trim().charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="grow">
              <b className="small">{profile?.name ?? 'Admin'}</b>
              <div className="tiny muted">{profile?.email ?? 'Admin Web'}</div>
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
      <PortalLayout notifications={<NotificationBell />}>
        <Outlet />
      </PortalLayout>
    </div>
  );
}
