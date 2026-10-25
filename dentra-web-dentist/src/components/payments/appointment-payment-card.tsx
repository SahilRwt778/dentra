import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { Appointment, ClinicCollectionMethod } from '@/api/generated-api';
import { Modal } from '@/components/modal';
import { rupees } from '@/lib/date';
import {
  CLINIC_METHODS,
  canCollectClinicPayment,
  collectedTime,
} from '@/lib/clinic-payment';
import { useClinicPayment } from './use-clinic-payment';

export function AppointmentPaymentCard({
  appointment,
  disabled = false,
}: {
  appointment: Appointment;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const payment = useClinicPayment(appointment, disabled);
  if (!appointment.payment) return null;
  const receipt = appointment.payment.collection;
  const canCollect = canCollectClinicPayment(appointment);
  function submit(event: FormEvent) {
    event.preventDefault();
    void payment.record();
  }
  return (
    <section className="card stack" aria-label="Appointment payment">
      <h3>Payment</h3>
      <dl className="kv">
        <dt>Consultation fee</dt>
        <dd>{rupees(appointment.payment.amountPaise)}</dd>
        <dt>Status</dt>
        <dd>
          {receipt
            ? 'Paid at clinic'
            : appointment.payment.status?.replace(/_/g, ' ')}
        </dd>
        {receipt && (
          <>
            <dt>Received by</dt>
            <dd>{CLINIC_METHODS[receipt.method]}</dd>
            <dt>Collected</dt>
            <dd>{collectedTime(receipt.collectedAt)} IST</dd>
            <dt>Receipt</dt>
            <dd className="small" style={{ overflowWrap: 'anywhere' }}>
              {receipt.id}
            </dd>
          </>
        )}
      </dl>
      {payment.notice && (
        <p role="status" className="small">
          {payment.notice}
        </p>
      )}
      {receipt && appointment.status === 'cancelled' && (
        <p className="hint">
          For any refund, arrange it directly with the clinic.
        </p>
      )}
      {canCollect && (
        <button
          type="button"
          className="btn btn-primary"
          disabled={disabled || payment.busy}
          onClick={() => setOpen(true)}
        >
          Mark as paid
        </button>
      )}
      {open && canCollect && (
        <Modal
          open
          onClose={() => {
            if (!payment.busy) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clinic-payment-title"
          >
            <div className="row between">
              <h2 id="clinic-payment-title">Record payment received</h2>
              <button
                type="button"
                className="btn"
                aria-label="Close payment form"
                disabled={payment.busy}
                onClick={() => setOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form className="stack" onSubmit={submit}>
              <p>
                {appointment.patientName} ·{' '}
                {rupees(appointment.payment.amountPaise)}
              </p>
              <p className="hint">
                Confirm only after receiving the full consultation fee at the
                clinic.
              </p>
              <label className="field">
                <span>Received by</span>
                <select
                  className="input"
                  required
                  disabled={payment.busy}
                  value={payment.method}
                  onChange={(event) =>
                    payment.selectMethod(
                      event.target.value as ClinicCollectionMethod | '',
                    )
                  }
                >
                  <option value="">Choose a payment method</option>
                  {Object.entries(CLINIC_METHODS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {payment.error && (
                <p
                  role="alert"
                  className="small"
                  style={{ color: 'var(--red)' }}
                >
                  {payment.error}
                </p>
              )}
              <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn"
                  disabled={payment.busy}
                  onClick={() => setOpen(false)}
                >
                  Go back
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={payment.busy || disabled || !payment.method}
                >
                  {payment.busy ? 'Recording…' : 'Confirm received'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </section>
  );
}
