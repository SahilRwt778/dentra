import { Link } from 'react-router-dom';
import { useGetDentistPayoutBatchQuery } from '@/api/payout-batches';
import { Modal } from '@/components/modal';
import { apiErrorMessage } from '@/lib/api-error';
import { rupees } from '@/lib/date';
import { collectedTime } from '@/lib/clinic-payment';
import { PAYOUT_STATUSES } from '@/lib/payout-batches';

export function PayoutDetailDialog({
  id,
  close,
}: {
  id: string;
  close: () => void;
}) {
  const result = useGetDentistPayoutBatchQuery(
    { batchId: id },
    {
      refetchOnMountOrArgChange: true,
      pollingInterval: 15000,
      skipPollingIfUnfocused: true,
    },
  );
  const batch = result.currentData;
  return (
    <Modal open onClose={close}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="payout-detail-title"
        className="stack"
      >
        <header className="row between">
          <h2 id="payout-detail-title">Payout details</h2>
          <button className="btn" onClick={close}>
            Close
          </button>
        </header>
        {result.error ? (
          <div role="alert">
            <p>{apiErrorMessage(result.error, 'Could not load payout.')}</p>
            <button className="btn" onClick={() => void result.refetch()}>
              Try again
            </button>
          </div>
        ) : !batch ? (
          <p role="status">Loading payout…</p>
        ) : (
          <>
            <h3>
              {rupees(batch.netPaise)} · {PAYOUT_STATUSES[batch.status]}
            </h3>
            <dl className="kv dentist-payment-references">
              <dt>Batch</dt>
              <dd>{batch.id}</dd>
              <dt>Gross collections</dt>
              <dd>{rupees(batch.grossPaise)}</dd>
              <dt>Platform fee ({(batch.feeBps / 100).toFixed(2)}%)</dt>
              <dd>{rupees(batch.feePaise)}</dd>
              <dt>Saved account</dt>
              <dd>
                Ending {batch.accountLast4} · {batch.bankIfsc}
              </dd>
              <dt>Created (IST)</dt>
              <dd>{collectedTime(batch.createdAt)}</dd>
              {batch.bankReference && (
                <>
                  <dt>Bank reference</dt>
                  <dd>{batch.bankReference}</dd>
                  <dt>Transfer date</dt>
                  <dd>{batch.paidOn}</dd>
                </>
              )}
            </dl>
            <p className="hint">
              Paid means an admin recorded the transfer. Bank credit is
              confirmed through your bank.
            </p>
            {batch.needsAttention && (
              <p role="alert" className="hint">
                A payment in this batch changed. Contact admin to review the
                discrepancy.
              </p>
            )}
            <h3>Included collections</h3>
            {batch.items.map((item) => (
              <div className="card stack" key={item.transactionId}>
                <b>{item.patientName}</b>
                <p>
                  Gross {rupees(item.amountPaise)} · Fee {rupees(item.feePaise)}
                </p>
                <p className="small muted">
                  Current payment: {item.paymentStatus.replace(/_/g, ' ')}
                  {item.released ? ' · reservation released' : ''}
                </p>
                <Link className="btn" to={`/consult/${item.appointmentId}`}>
                  Open appointment
                </Link>
              </div>
            ))}
            <h3>Activity</h3>
            {batch.events.map((event) => (
              <div key={event.id}>
                <b>{PAYOUT_STATUSES[event.status]}</b>
                <p className="small muted">
                  {collectedTime(event.createdAt)} IST
                </p>
                {event.note && <p>{event.note}</p>}
              </div>
            ))}
          </>
        )}
      </section>
    </Modal>
  );
}
