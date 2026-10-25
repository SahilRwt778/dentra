import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { WithdrawalStatus } from '@/api/generated-api';
import { useListAdminWithdrawalsQuery } from '@/api/wallet';
import { PageHead } from '@/components/page-head';
import { PayoutPagination } from '@/components/payouts/payout-pagination';
import { payoutError, payoutMoney, payoutTime } from '@/utils/payout-batches';
import { WITHDRAWAL_STATUSES } from '@/utils/wallet';

export function WithdrawalsPage() {
  const [status, setStatus] = useState<WithdrawalStatus | ''>('requested');
  const [search, setSearch] = useState(''),
    [q, setQuery] = useState('');
  const [page, setPage] = useState(1),
    [limit, setLimit] = useState(20);
  const result = useListAdminWithdrawalsQuery(
    { status: status || undefined, q: q || undefined, page, limit },
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
        title="Withdrawal requests"
        subtitle="Review dentist requests and track approved payouts."
        actions={
          <Link className="btn" to="/settings">
            Wallet settings
          </Link>
        }
      />
      <div className="stack">
        <form
          className="card row wrap"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search.trim());
            setPage(1);
          }}
        >
          <label className="field">
            Dentist or request reference
            <input
              className="input"
              maxLength={100}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button className="btn">Search</button>
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
            type="button"
            className="btn"
            disabled={result.isFetching}
            onClick={() => void result.refetch()}
          >
            Refresh
          </button>
        </form>
        {result.error ? (
          <div className="card" role="alert">
            <p>{payoutError(result.error)}</p>
            <button className="btn" onClick={() => void result.refetch()}>
              Try again
            </button>
          </div>
        ) : !data ? (
          <p role="status">Loading withdrawal requests…</p>
        ) : (
          <>
            {data.items.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Requested (IST)</th>
                      <th>Dentist</th>
                      <th>Amount</th>
                      <th>Account ending</th>
                      <th>Status</th>
                      <th>Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((w) => (
                      <tr key={w.id}>
                        <td>{payoutTime(w.createdAt)}</td>
                        <td>{w.dentistName}</td>
                        <td>
                          <b>{payoutMoney(w.amountPaise)}</b>
                        </td>
                        <td>{w.accountLast4}</td>
                        <td>{WITHDRAWAL_STATUSES[w.status]}</td>
                        <td>
                          <Link className="btn" to={`/withdrawals/${w.id}`}>
                            View request
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card empty">
                <h3>No matching withdrawal requests</h3>
                <p>Dentist-submitted requests appear here for approval.</p>
              </div>
            )}
            <p className="small muted">{data.total} matching requests</p>
            <PayoutPagination
              page={page}
              nextPage={data.nextPage}
              busy={result.isFetching}
              change={setPage}
            />
          </>
        )}
        <Link className="btn" to="/payout-batches">
          Earlier payout batches
        </Link>
      </div>
    </>
  );
}
