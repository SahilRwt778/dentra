import { Link, useParams } from 'react-router-dom';
import { useGetAdminPayoutBatchQuery } from '@/api/payout-batches';
import { PageHead } from '@/components/page-head';
import { PayoutBatchAction } from '@/components/payouts/payout-batch-action';
import {
  PAYOUT_STATUSES,
  payoutError,
  payoutMoney,
  payoutTime,
} from '@/utils/payout-batches';

export function PayoutBatchDetailPage() {
  const { batchId = '' } = useParams();
  const result = useGetAdminPayoutBatchQuery(
    { batchId },
    {
      refetchOnMountOrArgChange: true,
      pollingInterval: 15000,
      skipPollingIfUnfocused: true,
    },
  );
  const batch = result.currentData;
  return (
    <>
      <PageHead
        title="Payout batch"
        subtitle="Review the saved amounts, account and transfer history."
        actions={
          <button
            className="btn"
            disabled={result.isFetching}
            onClick={() => void result.refetch()}
          >
            Refresh
          </button>
        }
      />
      <div className="stack">
        <Link className="btn" to="/payout-batches">
          Back to payouts
        </Link>
        {result.error ? (
          <div className="card stack" role="alert">
            <p>{payoutError(result.error)}</p>
            <button className="btn" onClick={() => void result.refetch()}>
              Try again
            </button>
          </div>
        ) : !batch ? (
          <p role="status">Loading payout…</p>
        ) : (
          <>
            <div className="card stack">
              <div className="row between wrap">
                <h2>{batch.dentistName}</h2>
                <span className="badge">{PAYOUT_STATUSES[batch.status]}</span>
              </div>
              <p className="payout-reference small muted">
                Batch {batch.id} · Created {payoutTime(batch.createdAt)} IST
              </p>
              <dl className="kv">
                <dt>Gross collections</dt>
                <dd>{payoutMoney(batch.grossPaise)}</dd>
                <dt>Platform fee ({(batch.feeBps / 100).toFixed(2)}%)</dt>
                <dd>{payoutMoney(batch.feePaise)}</dd>
                <dt>Net payout</dt>
                <dd>
                  <b>{payoutMoney(batch.netPaise)}</b>
                </dd>
                <dt>Saved account holder</dt>
                <dd>{batch.account?.holder}</dd>
                <dt>Saved account</dt>
                <dd>{batch.account?.accountNo}</dd>
                <dt>IFSC</dt>
                <dd>{batch.bankIfsc}</dd>
                {batch.bankReference && (
                  <>
                    <dt>Bank reference</dt>
                    <dd className="payout-reference">{batch.bankReference}</dd>
                    <dt>Transfer date</dt>
                    <dd>{batch.paidOn}</dd>
                  </>
                )}
              </dl>
              <p className="hint">
                This is the approved account saved when the batch was created.
                Dentra records the admin’s transfer confirmation; it does not
                send or verify a bank transfer.
              </p>
              {batch.needsAttention && (
                <p className="payout-warning" role="alert">
                  A collection or appointment changed after this batch was
                  created. Review the discrepancies below. An already recorded
                  transfer remains in this ledger.
                </p>
              )}
            </div>
            <PayoutBatchAction
              key={`${batch.id}:${batch.version}`}
              batch={batch}
              refresh={result.refetch}
            />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Transaction</th>
                    <th>Gross</th>
                    <th>Fee</th>
                    <th>Current state</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.items.map((item) => (
                    <tr key={item.transactionId}>
                      <td>{item.patientName}</td>
                      <td className="payout-reference small">
                        {item.transactionId}
                      </td>
                      <td>{payoutMoney(item.amountPaise)}</td>
                      <td>{payoutMoney(item.feePaise)}</td>
                      <td>
                        {item.paymentStatus.replace(/_/g, ' ')} ·{' '}
                        {item.appointmentStatus.replace(/_/g, ' ')}
                        {item.released ? ' · reservation released' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card stack">
              <h3>Activity</h3>
              {batch.events.map((event) => (
                <div key={event.id}>
                  <b>{PAYOUT_STATUSES[event.status]}</b>
                  <span className="small muted">
                    {' '}
                    · {payoutTime(event.createdAt)} IST
                  </span>
                  {event.note && <p>{event.note}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
