import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useListAdminPayoutRequestsQuery } from '@/api/generated-api';
import { PageHead } from '@/components/page-head';

export function PayoutReviewPage() {
  const [page, setPage] = useState(1);
  const {
    currentData: data,
    error,
    isFetching,
    refetch,
  } = useListAdminPayoutRequestsQuery(
    { status: 'pending', page },
    {
      pollingInterval: 15000,
      skipPollingIfUnfocused: true,
      refetchOnMountOrArgChange: true,
    },
  );

  return (
    <>
      <PageHead
        title="Payout review"
        subtitle="Review bank and tax details submitted by dentists."
        actions={
          <button
            type="button"
            className="btn"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching ? 'Refreshing…' : 'Refresh requests'}
          </button>
        }
      />
      {error ? (
        <p role="alert">
          Could not load payout requests. Please refresh and try again.
        </p>
      ) : !data ? (
        <p className="muted" role="status">
          Loading payout requests…
        </p>
      ) : (
        <div aria-busy={isFetching}>
          {data.items.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Dentist</th>
                    <th>Mobile number</th>
                    <th>Submitted on (IST)</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link
                          className="dentist-name"
                          to={`/dentists/${item.dentistId}`}
                        >
                          {item.dentistName}
                        </Link>
                      </td>
                      <td className="dentist-mobile">{item.mobile}</td>
                      <td>
                        {new Date(item.submittedAt).toLocaleString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                        })}
                      </td>
                      <td>
                        <Link
                          className="btn"
                          to={`/dentists/${item.dentistId}#payout-details`}
                        >
                          Review payout details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card empty">
              <h2>No payout requests on this page</h2>
              <p>Submitted requests appear here until reviewed.</p>
            </div>
          )}
          <nav
            className="row appointments-pagination"
            style={{ justifyContent: 'flex-end' }}
            aria-label="Payout request pages"
          >
            <button
              type="button"
              className="btn"
              disabled={page === 1 || isFetching}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </button>
            <span className="small muted">Page {page}</span>
            <button
              type="button"
              className="btn"
              disabled={!data.nextPage || isFetching}
              onClick={() => setPage(data.nextPage!)}
            >
              Next
            </button>
          </nav>
        </div>
      )}
    </>
  );
}
