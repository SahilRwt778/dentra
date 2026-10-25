import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { WithdrawalStatus } from '@/api/generated-api';
import {
  useGetDentistWalletQuery,
  useListDentistWithdrawalsQuery,
} from '@/api/wallet';
import { WalletSummary } from '@/components/payments/wallet-summary';
import { WithdrawalRequestForm } from '@/components/payments/withdrawal-request-form';
import { PageHead } from '@/components/page-head';
import { apiErrorMessage } from '@/lib/api-error';
import { rupees } from '@/lib/date';
import { collectedTime } from '@/lib/clinic-payment';
import { WITHDRAWAL_STATUSES } from '@/lib/wallet';

const refreshOptions = {
  refetchOnMountOrArgChange: true,
  pollingInterval: 15000,
  skipPollingIfUnfocused: true,
};
export function WalletPage() {
  const [page, setPage] = useState(1),
    [status, setStatus] = useState<WithdrawalStatus | ''>('');
  const result = useGetDentistWalletQuery(undefined, refreshOptions),
    history = useListDentistWithdrawalsQuery(
      { page, limit: 20, status: status || undefined },
      refreshOptions,
    );
  function refresh() {
    void result.refetch();
    void history.refetch();
  }
  const wallet = result.currentData,
    data = history.currentData;
  return (
    <>
      <PageHead
        title="Wallet"
        subtitle="Your online earnings, withdrawal requests and payout history."
        actions={
          <button
            className="btn"
            disabled={result.isFetching || history.isFetching}
            onClick={refresh}
          >
            Refresh
          </button>
        }
      />
      <div className="stack">
        {result.error ? (
          <div role="alert" className="card">
            <p>
              {apiErrorMessage(result.error, 'Could not load your wallet.')}
            </p>
            <button className="btn" onClick={() => void result.refetch()}>
              Try again
            </button>
          </div>
        ) : !wallet ? (
          <p role="status">Loading wallet…</p>
        ) : (
          <>
            <WalletSummary wallet={wallet} />
            <WithdrawalRequestForm wallet={wallet} refresh={refresh} />
          </>
        )}
        <div className="row between wrap">
          <h2>Withdrawal history</h2>
          <label className="field">
            Status
            <select
              className="input"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as WithdrawalStatus | '');
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {Object.entries(WITHDRAWAL_STATUSES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {history.error ? (
          <div role="alert" className="card">
            <p>
              {apiErrorMessage(
                history.error,
                'Could not load withdrawal history.',
              )}
            </p>
            <button className="btn" onClick={() => void history.refetch()}>
              Retry history
            </button>
          </div>
        ) : !data ? (
          <p role="status">Loading withdrawal history…</p>
        ) : (
          <>
            {data.items.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Requested (IST)</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Account ending</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((w) => (
                      <tr key={w.id}>
                        <td>{collectedTime(w.createdAt)}</td>
                        <td>
                          <b>{rupees(w.amountPaise)}</b>
                        </td>
                        <td>{WITHDRAWAL_STATUSES[w.status]}</td>
                        <td>{w.accountLast4}</td>
                        <td>
                          <Link
                            className="btn"
                            to={`/wallet/withdrawals/${w.id}`}
                          >
                            View withdrawal
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card empty">
                <h3>No withdrawals for these filters</h3>
                <p>Your requests and admin decisions will appear here.</p>
              </div>
            )}
            <nav className="row wrap" aria-label="Withdrawal pages">
              <button
                className="btn"
                disabled={page === 1 || history.isFetching}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous page
              </button>
              <span>
                Page {page} · {data.total} requests
              </span>
              <button
                className="btn"
                disabled={!data.nextPage || history.isFetching}
                onClick={() => setPage(data.nextPage!)}
              >
                Next page
              </button>
            </nav>
          </>
        )}
        <Link className="btn" to="/payouts">
          Earlier payout batches
        </Link>
      </div>
    </>
  );
}
