import { Link, useParams } from 'react-router-dom';
import { useGetDentistWithdrawalQuery } from '@/api/wallet';
import { PageHead } from '@/components/page-head';
import { apiErrorMessage } from '@/lib/api-error';
import { rupees } from '@/lib/date';
import { collectedTime } from '@/lib/clinic-payment';
import { WITHDRAWAL_STATUSES } from '@/lib/wallet';

export function WithdrawalPage() {
  const { withdrawalId = '' } = useParams();
  const result = useGetDentistWithdrawalQuery(
    { withdrawalId },
    {
      refetchOnMountOrArgChange: true,
      pollingInterval: 15000,
      skipPollingIfUnfocused: true,
    },
  );
  const w = result.currentData;
  return (
    <>
      <PageHead
        title="Withdrawal request"
        subtitle="Track admin review and transfer confirmation."
      />
      <div className="stack">
        <Link className="btn" to="/wallet">
          Back to wallet
        </Link>
        {result.error ? (
          <div role="alert" className="card">
            <p>
              {apiErrorMessage(result.error, 'Could not load this withdrawal.')}
            </p>
            <button className="btn" onClick={() => void result.refetch()}>
              Try again
            </button>
          </div>
        ) : !w ? (
          <p role="status">Loading withdrawal…</p>
        ) : (
          <>
            <section className="card stack">
              <h2>{rupees(w.amountPaise)}</h2>
              <span className="badge">{WITHDRAWAL_STATUSES[w.status]}</span>
              <dl className="kv dentist-payment-references">
                <dt>Reference</dt>
                <dd>{w.id}</dd>
                <dt>Requested (IST)</dt>
                <dd>{collectedTime(w.createdAt)}</dd>
                <dt>Saved account</dt>
                <dd>
                  Ending {w.accountLast4} · {w.bankIfsc}
                </dd>
                {w.bankReference && (
                  <>
                    <dt>Bank reference</dt>
                    <dd>{w.bankReference}</dd>
                    <dt>Transfer date</dt>
                    <dd>{w.paidOn}</dd>
                  </>
                )}
              </dl>
              <p className="hint">
                Approval keeps the amount reserved until payment is completed.
                Declined and cancelled requests release it back to your wallet.
                Paid means admin recorded the transfer; confirm credit through
                your bank.
              </p>
              {w.accountChanged && (
                <p className="hint">
                  Your approved payout account changed after this request.
                  Contact admin before the transfer is processed.
                </p>
              )}
            </section>
            <section className="card stack">
              <h3>History</h3>
              {w.events.map((event) => (
                <div key={event.id}>
                  <b>{WITHDRAWAL_STATUSES[event.status]}</b>
                  <p className="small muted">
                    {collectedTime(event.createdAt)} IST
                  </p>
                  {event.note && <p>{event.note}</p>}
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </>
  );
}
