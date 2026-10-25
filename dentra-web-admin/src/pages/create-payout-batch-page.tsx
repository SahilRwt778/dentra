import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useListPayoutDentistsQuery } from '@/api/payout-batches';
import { PageHead } from '@/components/page-head';
import { PayoutBatchBuilder } from '@/components/payouts/payout-batch-builder';
import { PayoutPagination } from '@/components/payouts/payout-pagination';
import { payoutError, payoutMoney } from '@/utils/payout-batches';

export function CreatePayoutBatchPage() {
  const [search, setSearch] = useState('');
  const [q, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [dentist, setDentist] = useState<{ id: string; name: string } | null>(
    null,
  );
  const result = useListPayoutDentistsQuery(
    { q: q || undefined, page, limit: 20 },
    { skip: !!dentist, refetchOnMountOrArgChange: true },
  );
  return (
    <>
      <PageHead
        title="Create payout batch"
        subtitle="Select completed online collections and review the agreed platform fee."
      />
      <div className="stack">
        <Link className="btn" to="/payout-batches">
          Back to payouts
        </Link>
        {dentist ? (
          <>
            <div className="card">
              <h2>{dentist.name}</h2>
              <p>Return to payout history to choose another dentist.</p>
            </div>
            <PayoutBatchBuilder key={dentist.id} dentistId={dentist.id} />
          </>
        ) : (
          <>
            <form
              className="card row wrap"
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(search.trim());
                setPage(1);
              }}
            >
              <label className="field">
                Search dentist name
                <input
                  className="input"
                  value={search}
                  maxLength={100}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <button className="btn">Search</button>
            </form>
            {result.error ? (
              <div className="card" role="alert">
                <p>{payoutError(result.error)}</p>
                <button className="btn" onClick={() => void result.refetch()}>
                  Try again
                </button>
              </div>
            ) : !result.currentData ? (
              <p role="status">Loading dentists…</p>
            ) : (
              <>
                {result.currentData.items.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Dentist</th>
                          <th>Eligible payments</th>
                          <th>Gross</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {result.currentData.items.map((item) => (
                          <tr key={item.id}>
                            <td>{item.name}</td>
                            <td>{item.eligibleCount}</td>
                            <td>{payoutMoney(item.grossPaise)}</td>
                            <td>
                              <button
                                className="btn"
                                onClick={() => setDentist(item)}
                              >
                                Select dentist
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="card empty">
                    <h3>No eligible collections</h3>
                    <p>
                      Only completed, captured online payments without refunds
                      or existing reservations appear here.
                    </p>
                  </div>
                )}
                <PayoutPagination
                  page={page}
                  nextPage={result.currentData.nextPage}
                  busy={result.isFetching}
                  change={setPage}
                />
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
