import type { AdminAppointment } from '@/api/generated-api';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  booked: { label: 'Scheduled', className: 'badge blue' },
  waiting: { label: 'Waiting', className: 'badge amber' },
  in_consult: { label: 'In consultation', className: 'badge teal' },
  completed: { label: 'Completed', className: 'badge green' },
  cancelled: { label: 'Cancelled', className: 'badge' },
};

function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

// scheduled_date is a plain calendar date ("2027-05-01"), not a
// timestamp — going through `new Date(iso).toLocaleDateString()` would
// reintroduce the exact UTC/local timezone shift bug dentra-api's own
// database.module.ts type-parser override exists to fix on the backend
// side. Splitting the string sidesteps Date parsing entirely.
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function PaymentCell({ payment }: { payment: AdminAppointment['payment'] }) {
  if (!payment || payment.amountPaise == null) return <>—</>;
  if (payment.status === 'refunded') {
    return <span className="muted">{rupees(payment.amountPaise)} refunded</span>;
  }
  if (payment.status === 'refund_pending' || payment.status === 'refund_failed') {
    return <span className="muted">{rupees(payment.amountPaise)} · {payment.status === 'refund_pending' ? 'Refund processing' : 'Refund needs attention'}</span>;
  }
  if (payment.status === 'due_at_clinic') {
    return (
      <>
        {rupees(payment.amountPaise)}
        <div className="tiny muted">Due at clinic</div>
      </>
    );
  }
  if (payment.status === 'cancelled' || payment.status === 'failed') {
    return <span className="muted">Not charged</span>;
  }
  return <>{rupees(payment.amountPaise)}</>;
}

export function AppointmentTable({ items }: { items: AdminAppointment[] }) {
  if (items.length === 0) {
    return (
      <div className="card empty">
        <p>No appointments here.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date and time</th>
            <th>Patient</th>
            <th>Dentist</th>
            <th>Visit</th>
            <th>Reason</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => {
            const badge = STATUS_BADGE[a.status ?? ''] ?? { label: a.status, className: 'badge' };
            return (
              <tr key={a.id}>
                <td>
                  {a.date ? formatDate(a.date) : '—'}
                  <div className="tiny muted">{a.time?.slice(0, 5)}</div>
                </td>
                <td>{a.patientName}</td>
                <td>{a.dentistName}</td>
                <td>{a.type === 'video' ? 'Video' : 'In-clinic'}</td>
                <td>{a.concern}</td>
                <td>
                  <span className={badge.className}>{badge.label}</span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <PaymentCell payment={a.payment} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
