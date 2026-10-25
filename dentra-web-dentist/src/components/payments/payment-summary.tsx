import type { DentistPaymentSummary } from '@/api/generated-api';
import { rupees } from '@/lib/date';
import { PAYMENT_SUMMARY_FIELDS } from '@/lib/payment-report';

export function PaymentSummary({
  summary,
}: {
  summary: DentistPaymentSummary;
}) {
  return (
    <section aria-label="Payment totals for these filters" className="stack">
      <div className="stats dentist-payment-stats">
        {PAYMENT_SUMMARY_FIELDS.map((field) => (
          <div className="stat" key={field.key}>
            <b>{rupees(summary[field.key])}</b>
            <span>{field.label}</span>
          </div>
        ))}
      </div>
      <p className="small muted">
        Totals show current payment states for these filters, before fees and
        payouts. Failed online attempts remain awaiting payment.
      </p>
    </section>
  );
}
