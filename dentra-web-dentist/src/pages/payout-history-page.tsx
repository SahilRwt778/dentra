import { useState } from 'react';
import type { PayoutBatchStatus } from '@/api/generated-api';
import { useListDentistPayoutBatchesQuery } from '@/api/payout-batches';
import { PageHead } from '@/components/page-head';
import { PayoutDetailDialog } from '@/components/payments/payout-detail-dialog';
import { apiErrorMessage } from '@/lib/api-error';
import { rupees } from '@/lib/date';
import { collectedTime } from '@/lib/clinic-payment';
import { PAYOUT_STATUSES } from '@/lib/payout-batches';

export function PayoutHistoryPage() {
  const [status, setStatus] = useState<PayoutBatchStatus | ''>('');
  const [page, setPage] = useState(1);
  const [id, setId] = useState<string | null>(null);
  const result = useListDentistPayoutBatchesQuery(
    { status: status || undefined, page, limit: 20 },
    {
      refetchOnMountOrArgChange: true,
      pollingInterval: 15000,
      skipPollingIfUnfocused: true,
    },
  );
  const data = result.currentData;
  return (
    <>
      <PageHead
        title="Payout history"
        subtitle="Track online collections reserved for payout and transfers recorded by admin."
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
        <label className="field">
          Payout status
          <select
            className="input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as PayoutBatchStatus | '');
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {Object.entries(PAYOUT_STATUSES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {result.error ? (
          <div className="card" role="alert">
            <p>{apiErrorMessage(result.error, 'Could not load payouts.')}</p>
            <button className="btn" onClick={() => void result.refetch()}>
              Try again
            </button>
          </div>
        ) : !data ? (
          <p role="status">Loading payouts…</p>
        ) : (
          <>
            <div className="stats">
              <div className="stat">
                <b>{rupees(data.reservedPaise)}</b>
                <span>Reserved · these filters</span>
              </div>
              <div className="stat">
                <b>{rupees(data.paidPaise)}</b>
                <span>Recorded paid · these filters</span>
              </div>
            </div>
            <p className="hint">
              Batches include completed online consultations after the agreed
              platform fee. Clinic collections are received directly by your
              clinic.
            </p>
            {data.items.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Created (IST)</th>
                      <th>Status</th>
                      <th>Gross</th>
                      <th>Fee</th>
                      <th>Net payout</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((batch) => (
                      <tr key={batch.id}>
                        <td>{collectedTime(batch.createdAt)}</td>
                        <td>
                          {PAYOUT_STATUSES[batch.status]}
                          {batch.needsAttention && (
                            <div className="small">Needs review</div>
                          )}
                        </td>
                        <td>{rupees(batch.grossPaise)}</td>
                        <td>{rupees(batch.feePaise)}</td>
                        <td>
                          <b>{rupees(batch.netPaise)}</b>
                        </td>
                        <td>
                          <button
                            className="btn"
                            onClick={() => setId(batch.id)}
                          >
                            View payout
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card empty">
                <h3>No payouts yet for these filters</h3>
                <p>Admin-created batches will appear here.</p>
              </div>
            )}
            <nav aria-label="Payout pages" className="row wrap">
              <button
                className="btn"
                disabled={page === 1 || result.isFetching}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous page
              </button>
              <span>
                Page {page} · {data.total} batches
              </span>
              <button
                className="btn"
                disabled={!data.nextPage || result.isFetching}
                onClick={() => setPage(data.nextPage!)}
              >
                Next page
              </button>
            </nav>
          </>
        )}
      </div>
      {id && <PayoutDetailDialog key={id} id={id} close={() => setId(null)} />}
    </>
  );
}
