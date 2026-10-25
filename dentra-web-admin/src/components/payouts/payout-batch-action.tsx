import { useRef, useState } from 'react';
import type { ChangePayoutBatch, PayoutBatchDetail } from '@/api/generated-api';
import { useChangePayoutBatchMutation } from '@/api/payout-batches';
import {
  payoutError,
  payoutMoney,
  uncertainPayoutError,
} from '@/utils/payout-batches';

export function PayoutBatchAction({
  batch,
  refresh,
}: {
  batch: PayoutBatchDetail;
  refresh: () => unknown;
}) {
  const [action, setAction] = useState<ChangePayoutBatch['action']>(
    batch.status === 'processing' ? 'paid' : 'processing',
  );
  const [reference, setReference] = useState('');
  const [today] = useState(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
  );
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<ChangePayoutBatch | null>(null);
  const locked = useRef(false);
  const [update, { isLoading }] = useChangePayoutBatchMutation();
  if (batch.status === 'paid' || batch.status === 'cancelled') return null;
  const frozen = isLoading || !!attempt;
  async function submit() {
    if (locked.current) return;
    let request = attempt;
    if (!request) {
      if (!confirmed) return;
      if (
        action === 'paid' &&
        (!/^[A-Za-z0-9][A-Za-z0-9._/-]{2,99}$/.test(reference.trim()) ||
          !paidOn)
      ) {
        setError('Enter the bank reference and transfer date.');
        return;
      }
      if ((action === 'failed' || action === 'cancelled') && !note.trim()) {
        setError('Enter a reason for this action.');
        return;
      }
      if (
        batch.needsAttention &&
        (action === 'processing' || (action === 'paid' && !acknowledged))
      )
        return;
      request = {
        requestId: crypto.randomUUID(),
        version: batch.version,
        action,
        ...(action === 'paid'
          ? {
              reference: reference.trim().toUpperCase(),
              paidOn,
              ...(acknowledged ? { acknowledgeChanges: true } : {}),
            }
          : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      };
      setAttempt(request);
    }
    locked.current = true;
    setError(null);
    try {
      await update({
        batchId: batch.id,
        changePayoutBatch: request,
      }).unwrap();
      setAttempt(null);
      refresh();
    } catch (e) {
      if (!uncertainPayoutError(e)) {
        setAttempt(null);
        refresh();
      }
      setError(payoutError(e));
    } finally {
      locked.current = false;
    }
  }
  const actions: ChangePayoutBatch['action'][] =
    batch.status === 'processing'
      ? ['paid', 'failed']
      : ['processing', 'cancelled'];
  return (
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h3>Record payout progress</h3>
      <label className="field">
        Action
        <select
          className="input"
          value={action}
          disabled={frozen}
          onChange={(e) => {
            setAction(e.target.value as ChangePayoutBatch['action']);
            setConfirmed(false);
            setAcknowledged(false);
          }}
        >
          {actions.map((value) => (
            <option key={value} value={value}>
              {value === 'processing'
                ? 'Start processing'
                : value === 'paid'
                ? 'Record bank transfer as paid'
                : value === 'failed'
                ? 'Record confirmed transfer failure'
                : 'Cancel and release payments'}
            </option>
          ))}
        </select>
      </label>
      {action === 'processing' && (
        <p className="hint">
          Eligibility and the approved account will be checked again. After
          processing starts, transfer exactly {payoutMoney(batch.netPaise)} to
          the saved account outside Dentra, then record its bank reference here.
        </p>
      )}
      {action === 'paid' && (
        <>
          <label className="field">
            Bank transfer reference
            <input
              className="input"
              value={reference}
              disabled={frozen}
              required
              minLength={3}
              maxLength={100}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <label className="field">
            Transfer date (IST)
            <input
              className="input"
              type="date"
              value={paidOn}
              disabled={frozen}
              required
              max={today}
              onChange={(e) => setPaidOn(e.target.value)}
            />
          </label>
          {batch.needsAttention && (
            <label className="row">
              <input
                type="checkbox"
                checked={acknowledged}
                disabled={frozen}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              I acknowledge the changed payment state and am recording a
              transfer that actually occurred.
            </label>
          )}
        </>
      )}
      {(action === 'failed' || action === 'cancelled') && (
        <p className="hint">
          Confirm with the bank that no money was transferred. Failed batches
          stay reserved. Cancellation releases their collections for a new
          batch.
        </p>
      )}
      <label className="field">
        {action === 'failed' || action === 'cancelled'
          ? 'Reason'
          : 'Note (optional)'}
        <textarea
          className="input"
          value={note}
          disabled={frozen}
          maxLength={300}
          required={action === 'failed' || action === 'cancelled'}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <label className="row">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={frozen}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        {action === 'paid'
          ? `I confirm ${payoutMoney(
              batch.netPaise,
            )} was transferred to the saved account.`
          : action === 'processing'
          ? 'I checked this batch and the saved account.'
          : 'I confirmed no money was transferred and checked this action.'}
      </label>
      {error && <p role="alert">{error}</p>}
      {!!attempt && !isLoading && (
        <p className="hint">
          The result is unconfirmed. Retry the same request to recover it
          safely.
        </p>
      )}
      <button
        className="btn btn-primary"
        disabled={
          isLoading ||
          (!attempt &&
            (!confirmed ||
              (action === 'processing' && batch.needsAttention) ||
              (action === 'paid' && batch.needsAttention && !acknowledged)))
        }
      >
        {isLoading
          ? 'Saving…'
          : attempt
          ? 'Retry same request'
          : 'Save payout progress'}
      </button>
    </form>
  );
}
