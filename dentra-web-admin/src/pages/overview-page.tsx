import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import {
  useGetAdminAppointmentsQuery,
  useGetAdminDentistsQuery,
} from '@/api/generated-api';
import { PageHead } from '@/components/page-head';
import { AppointmentTable } from '@/components/appointment-table';

function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

const TODAY_LABEL = new Date().toLocaleDateString(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function OverviewPage() {
  const { data: todayAppointments, isLoading } = useGetAdminAppointmentsQuery({
    filter: 'today',
  });
  const { data: pendingDentists } = useGetAdminDentistsQuery({
    status: 'pending_review',
  });

  const items = todayAppointments?.items ?? [];
  const summary = todayAppointments?.summary;
  const pendingCount = pendingDentists?.items?.length ?? 0;

  return (
    <>
      <PageHead title="Overview" subtitle={TODAY_LABEL} />

      {isLoading ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <b>{summary?.notCancelled ?? 0}</b>
              <span>Appointments today</span>
            </div>
            <div className="stat">
              <b>{summary?.completed ?? 0}</b>
              <span>Completed</span>
            </div>
            <div className="stat">
              <b>{summary?.cancelled ?? 0}</b>
              <span>Cancelled</span>
            </div>
            <div className="stat">
              <b>{rupees(summary?.paidAmountPaise ?? 0)}</b>
              <span>Paid for today's visits</span>
            </div>
          </div>

          {pendingCount > 0 && (
            <div className="card row between" style={{ marginBottom: 18 }}>
              <div className="row">
                <ShieldCheck size={18} />
                <span>
                  <b>{pendingCount} dentists</b> are waiting for verification.
                </span>
              </div>
              <Link to="/dentists/review" className="btn">
                Review
              </Link>
            </div>
          )}

          <h2 style={{ marginBottom: 12 }}>Today's appointments</h2>
          <AppointmentTable items={items} />
          {!!todayAppointments?.nextPage && (
            <p className="small muted" style={{ marginTop: 12 }}>
              Showing the first {items.length} appointments.{' '}
              <Link to="/appointments" className="link">
                View all today's appointments
              </Link>
            </p>
          )}
        </>
      )}
    </>
  );
}
