import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useCreatePayoutBatchMutation,
  useListEligiblePayoutsQuery,
} from '@/api/payout-batches';
import type { CreatePayoutBatch, EligiblePayouts } from '@/api/generated-api';
import { PayoutPagination } from './payout-pagination';
import {
  feeBasisPoints,
  payoutError,
  payoutItemFee,
  payoutMoney,
  uncertainPayoutError,
} from '@/utils/payout-batches';

export function PayoutBatchBuilder({ dentistId }: { dentistId: string }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<
    Record<string, EligiblePayouts['items'][number]>
  >({});
  const [percent, setPercent] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<CreatePayoutBatch | null>(null);
  const lock = useRef(false);
  const [create, { isLoading }] = useCreatePayoutBatchMutation();
  const result = useListEligiblePayoutsQuery(
    { dentistId, page, limit: 20 },
    { refetchOnMountOrArgChange: true },
  );
  const data = result.currentData;
  const items = Object.values(selected);
  const bps = feeBasisPoints(percent);
  const gross = items.reduce((sum, item) => sum + item.amountPaise, 0);
  const fee =
    bps === null
      ? 0
      : items.reduce(
          (sum, item) => sum + payoutItemFee(item.amountPaise, bps),
          0,
        );
  const frozen = isLoading || !!attempt;
  async function submit() {
    if (lock.current) return;
    let request = attempt;
    if (!request) {
      if (
        !data?.account ||
        !items.length ||
        bps === null ||
        gross - fee <= 0 ||
        !confirmed
      )
        return;
      request = {
        requestId: crypto.randomUUID(),
        dentistId,
        accountApprovalId: data.account.approvalId,
        transactionIds: items.map((item) => item.id).sort(),
        feeBps: bps,
      };
      setAttempt(request);
    }
    lock.current = true;
    setError(null);
    try {
      const batch = await create({
        createPayoutBatch: request,
      }).unwrap();
      setAttempt(null);
      navigate(`/payout-batches/${batch.id}`, { replace: true });
    } catch (e) {
      if (!uncertainPayoutError(e)) setAttempt(null);
      setError(payoutError(e));
    } finally {
      lock.current = false;
    }
  }
  if (result.error)
    return (
      <div className="card stack" role="alert">
        <p>{payoutError(result.error)}</p>
        <button className="btn" onClick={() => void result.refetch()}>
          Try again
        </button>
      </div>
    );
  if (!data) return <p role="status">Loading eligible payments…</p>;
  return (
    <div className="stack">
      <div className="card stack">
        <h3>Eligible online collections</h3>
        <p>
          {data.total} completed paid consultations ·{' '}
          {payoutMoney(data.grossPaise)} available before fees.
        </p>
        {data.account ? (
          <p>
            Approved account ending <b>{data.account.last4}</b> ·{' '}
            {data.account.ifsc}
          </p>
        ) : (
          <p role="alert">
            Approve this dentist’s bank details before creating a payout batch.
          </p>
        )}
        <button
          className="btn"
          disabled={frozen || result.isFetching}
          onClick={() => {
            setSelected({});
            setConfirmed(false);
            void result.refetch();
          }}
        >
          Refresh eligibility and clear selection
        </button>
      </div>
      {data.items.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Select</th>
                <th>Patient</th>
                <th>Visit</th>
                <th>Gross</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${item.patientName} ${item.appointmentDate} ${item.appointmentTime}`}
                      checked={!!selected[item.id]}
                      disabled={
                        frozen || (!selected[item.id] && items.length >= 100)
                      }
                      onChange={(e) => {
                        setSelected((current) => {
                          const next = { ...current };
                          if (e.target.checked) next[item.id] = item;
                          else delete next[item.id];
                          return next;
                        });
                        setConfirmed(false);
                      }}
                    />
                  </td>
                  <td>{item.patientName}</td>
                  <td>
                    {item.appointmentDate} · {item.appointmentTime}
                  </td>
                  <td>{payoutMoney(item.amountPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card empty">No eligible collections on this page.</div>
      )}
      <PayoutPagination
        page={page}
        nextPage={data.nextPage}
        busy={frozen || result.isFetching}
        change={setPage}
      />
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h3>Review batch · {items.length} selected</h3>
        <label className="field">
          Agreed platform fee (%)
          <input
            className="input"
            inputMode="decimal"
            value={percent}
            disabled={frozen}
            placeholder="Enter the agreed percentage"
            onChange={(e) => {
              setPercent(e.target.value);
              setConfirmed(false);
            }}
            required
          />
        </label>
        {percent && bps === null && (
          <p role="alert">
            Enter a percentage from 0 to 100 with up to two decimal places.
          </p>
        )}
        <p>
          Gross {payoutMoney(gross)} · Platform fee {payoutMoney(fee)} ·{' '}
          <b>Net payout {payoutMoney(gross - fee)}</b>
        </p>
        <p className="hint">
          Fees round to the nearest paise for each collection. This batch
          reserves the selected payments and saves the approved account. No bank
          transfer is initiated.
        </p>
        <label className="row">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={frozen}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I checked the selected payments, account and agreed fee.
        </label>
        {error && <p role="alert">{error}</p>}
        {!!attempt && !isLoading && (
          <p className="hint">
            The previous result is unconfirmed. Retry the same request to
            recover it safely.
          </p>
        )}
        <button
          className="btn btn-primary"
          disabled={
            isLoading ||
            (!attempt &&
              (!confirmed ||
                bps === null ||
                !data.account ||
                !items.length ||
                gross - fee <= 0))
          }
        >
          {isLoading
            ? 'Creating…'
            : attempt
            ? 'Retry same request'
            : 'Create payout batch'}
        </button>
      </form>
    </div>
  );
}
