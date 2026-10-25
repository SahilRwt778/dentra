import { Link, useParams } from 'react-router-dom';
import { useGetAdminWithdrawalQuery } from '@/api/wallet';
import { PageHead } from '@/components/page-head';
import { WithdrawalActions } from '@/components/payouts/withdrawal-actions';
import { payoutError, payoutMoney, payoutTime } from '@/utils/payout-batches';
import { WITHDRAWAL_STATUSES } from '@/utils/wallet';

export function WithdrawalDetailPage() {
  const { withdrawalId = '' } = useParams();
  const result = useGetAdminWithdrawalQuery(
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
        subtitle="Review the dentist’s reserved amount and approved payout account."
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
        <Link className="btn" to="/withdrawals">
          Back to withdrawal requests
        </Link>
        {result.error ? (
          <div className="card" role="alert">
            <p>{payoutError(result.error)}</p>
            <button className="btn" onClick={() => void result.refetch()}>
              Try again
            </button>
          </div>
        ) : !w ? (
          <p role="status">Loading withdrawal…</p>
        ) : (
          <>
            <section className="card stack">
              <div className="row between wrap">
                <h2>{w.dentistName}</h2>
                <span className="badge">{WITHDRAWAL_STATUSES[w.status]}</span>
              </div>
              <h2>{payoutMoney(w.amountPaise)}</h2>
              <p className="small muted payout-reference">
                Request {w.id} · {payoutTime(w.createdAt)} IST
              </p>
              <p className="hint">
                This amount is already after platform fees. No additional fee is
                deducted on withdrawal.
              </p>
              <dl className="kv">
                <dt>Saved account holder</dt>
                <dd>{w.account?.holder}</dd>
                <dt>Saved account</dt>
                <dd>{w.account?.accountNo}</dd>
                <dt>IFSC</dt>
                <dd>{w.bankIfsc}</dd>
                <dt>Minimum when requested</dt>
                <dd>{payoutMoney(w.minimumPaise)}</dd>
                <dt>Wallet available now</dt>
                <dd>{payoutMoney(w.wallet.availablePaise)}</dd>
                <dt>Total reserved</dt>
                <dd>{payoutMoney(w.wallet.reservedPaise)}</dd>
                {w.bankReference && (
                  <>
                    <dt>Bank reference</dt>
                    <dd className="payout-reference">{w.bankReference}</dd>
                    <dt>Transfer date</dt>
                    <dd>{w.paidOn}</dd>
                  </>
                )}
              </dl>
              {w.accountChanged && (
                <p role="alert" className="payout-warning">
                  The approved bank account changed after this request was
                  submitted.
                </p>
              )}
              {w.wallet.shortfallPaise > 0 && (
                <p role="alert" className="payout-warning">
                  Wallet earnings adjustment:{' '}
                  {payoutMoney(w.wallet.shortfallPaise)}. Review outstanding
                  requests and refunds.
                </p>
              )}
            </section>
            <WithdrawalActions
              key={`${w.id}:${w.version}`}
              withdrawal={w}
              refresh={result.refetch}
            />
            <section className="card stack">
              <h3>History</h3>
              {w.events.map((event) => (
                <div key={event.id}>
                  <b>{WITHDRAWAL_STATUSES[event.status]}</b>
                  <p className="small muted">
                    {payoutTime(event.createdAt)} IST
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
