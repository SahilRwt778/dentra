import type { FormEvent } from 'react';
import type { PaymentFilters } from '@/lib/payment-filters';
import { PAYMENT_STATUSES } from '@/lib/payment-report';

export function PaymentFiltersForm({
  value,
  onChange,
  onApply,
  onClear,
  error,
}: {
  value: PaymentFilters;
  onChange: (changes: Partial<PaymentFilters>) => void;
  onApply: () => void;
  onClear: () => void;
  error: string | null;
}) {
  function submit(event: FormEvent) {
    event.preventDefault();
    onApply();
  }
  return (
    <form
      className="card dentist-payment-filters"
      onSubmit={submit}
      aria-label="Payment filters"
    >
      <label className="field dentist-payment-search">
        <span>Patient or payment reference</span>
        <input
          className="input"
          value={value.q}
          maxLength={100}
          onChange={(event) => onChange({ q: event.target.value })}
        />
      </label>
      <label className="field">
        <span>Payment source</span>
        <select
          className="input"
          value={value.source}
          onChange={(event) =>
            onChange({ source: event.target.value as PaymentFilters['source'] })
          }
        >
          <option value="">All sources</option>
          <option value="online">Online</option>
          <option value="clinic">At clinic</option>
        </select>
      </label>
      <label className="field">
        <span>Payment status</span>
        <select
          className="input"
          value={value.status}
          onChange={(event) =>
            onChange({ status: event.target.value as PaymentFilters['status'] })
          }
        >
          <option value="">All statuses</option>
          {Object.entries(PAYMENT_STATUSES).map(([key, status]) => (
            <option value={key} key={key}>
              {status.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Transaction date from</span>
        <input
          className="input"
          type="date"
          value={value.from}
          onChange={(event) => onChange({ from: event.target.value })}
        />
      </label>
      <label className="field">
        <span>Transaction date to</span>
        <input
          className="input"
          type="date"
          value={value.to}
          onChange={(event) => onChange({ to: event.target.value })}
        />
      </label>
      <div className="row wrap dentist-payment-filter-actions">
        <button className="btn btn-primary" type="submit">
          Apply filters
        </button>
        <button className="btn" type="button" onClick={onClear}>
          Clear filters
        </button>
      </div>
      <p className="hint dentist-payment-filter-note">
        Dates use the booking transaction’s creation time in IST. Apply filters
        to update totals and history.
      </p>
      {error && (
        <p className="small dentist-payment-filter-note" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
