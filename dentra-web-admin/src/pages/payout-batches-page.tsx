import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { PayoutBatchStatus } from '@/api/generated-api';
import { useListAdminPayoutBatchesQuery } from '@/api/payout-batches';
import { PageHead } from '@/components/page-head';
import { PayoutPagination } from '@/components/payouts/payout-pagination';
import {
  PAYOUT_STATUSES,
  payoutError,
  payoutMoney,
  payoutTime,
} from '@/utils/payout-batches';

export function PayoutBatchesPage() {
  const [status, setStatus] = useState<PayoutBatchStatus | ''>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const result = useListAdminPayoutBatchesQuery(
    { status: status || undefined, page, limit },
    {
      pollingInterval: 15000,
      skipPollingIfUnfocused: true,
      refetchOnMountOrArgChange: true,
    },
  );
  const data = result.currentData;
  return (
    <>
      <PageHead
        title="Payout transfers"
        subtitle="Prepare batches and record bank transfers made outside Dentra."
        actions={
          <Link className="btn btn-primary" to="/withdrawals">
            Withdrawal requests
          </Link>
        }
      />
      <div className="stack">
        <div className="card row wrap">
          <label className="field">
            Status
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
          <label className="field">
            Rows per page
            <select
              className="input"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              {[20, 50, 100].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <button
            className="btn"
            disabled={result.isFetching}
            onClick={() => void result.refetch()}
          >
            Refresh
          </button>
        </div>
        {result.error ? (
          <div role="alert" className="card">
            <p>{payoutError(result.error)}</p>
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
                <b>{payoutMoney(data.reservedPaise)}</b>
                <span>Reserved · matching batches</span>
              </div>
              <div className="stat">
                <b>{payoutMoney(data.paidPaise)}</b>
                <span>Recorded paid · matching batches</span>
              </div>
              <div className="stat">
                <b>{data.total}</b>
                <span>Batches</span>
              </div>
            </div>
            <p className="hint">
              Failed transfers remain reserved until retried or cancelled after
              confirming no transfer occurred.
            </p>
            {data.items.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Created (IST)</th>
                      <th>Dentist</th>
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
                        <td>{payoutTime(batch.createdAt)}</td>
                        <td>{batch.dentistName}</td>
                        <td>
                          <span
                            className={`badge ${
                              batch.status === 'paid'
                                ? 'green'
                                : batch.status === 'failed'
                                ? 'red'
                                : 'amber'
                            }`}
                          >
                            {PAYOUT_STATUSES[batch.status]}
                          </span>
                          {batch.needsAttention && (
                            <p className="small">Payment discrepancy</p>
                          )}
                        </td>
                        <td>{payoutMoney(batch.grossPaise)}</td>
                        <td>{payoutMoney(batch.feePaise)}</td>
                        <td>
                          <b>{payoutMoney(batch.netPaise)}</b>
                        </td>
                        <td>
                          <Link
                            className="btn"
                            to={`/payout-batches/${batch.id}`}
                          >
                            View batch
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card empty">
                <h3>No matching batches</h3>
                <p>Create a batch from completed online collections.</p>
              </div>
            )}
            <PayoutPagination
              page={page}
              nextPage={data.nextPage}
              busy={result.isFetching}
              change={setPage}
            />
          </>
        )}
      </div>
    </>
  );
}
