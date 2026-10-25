import type { DentistPayment } from '@/api/generated-api';
import { formatDate, formatTime, rupees } from '@/lib/date';
import { collectedTime } from '@/lib/clinic-payment';
import { reportPaymentMethod, PAYMENT_STATUSES } from '@/lib/payment-report';

export function PaymentTable({
  payments,
  onOpen,
}: {
  payments: DentistPayment[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="dentist-payment-table">
        <thead>
          <tr>
            <th>Transaction date</th>
            <th>Patient</th>
            <th>Appointment</th>
            <th>Method</th>
            <th>Status</th>
            <th>Amount</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td className="small">{collectedTime(payment.createdAt)}</td>
              <td>
                <b>{payment.patientName}</b>
              </td>
              <td className="small">
                {formatDate(payment.appointmentDate)} ·{' '}
                {formatTime(payment.appointmentTime)}
                <div className="tiny muted">
                  {payment.appointmentType === 'video'
                    ? 'Video consultation'
                    : payment.clinicName ?? 'In-clinic visit'}
                </div>
              </td>
              <td className="small">{reportPaymentMethod(payment)}</td>
              <td>
                <span
                  className={`badge ${PAYMENT_STATUSES[payment.status].color}`}
                >
                  {PAYMENT_STATUSES[payment.status].label}
                </span>
              </td>
              <td className="dentist-payment-amount">
                {rupees(payment.amountPaise)}
              </td>
              <td>
                <button
                  className="btn small"
                  type="button"
                  aria-label={`View payment for ${payment.patientName}`}
                  onClick={() => onOpen(payment.id)}
                >
                  View details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
