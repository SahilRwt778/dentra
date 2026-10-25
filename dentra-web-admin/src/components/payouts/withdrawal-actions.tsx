import { useRef, useState } from 'react';
import type { WithdrawalAction, WithdrawalDetail } from '@/api/generated-api';
import { useChangeWithdrawalMutation } from '@/api/wallet';
import {
  payoutError,
  payoutMoney,
  uncertainPayoutError,
} from '@/utils/payout-batches';

const ACTION_LABELS = {
  approved: 'Approve request',
  rejected: 'Decline request',
  processing: 'Start processing',
  paid: 'Record transfer as paid',
  failed: 'Record confirmed failure',
  cancelled: 'Cancel and release amount',
};
export function WithdrawalActions({
  withdrawal,
  refresh,
}: {
  withdrawal: WithdrawalDetail;
  refresh: () => unknown;
}) {
  const [action, setAction] = useState<WithdrawalAction['action']>(
    withdrawal.status === 'requested'
      ? 'approved'
      : withdrawal.status === 'processing'
      ? 'paid'
      : 'processing',
  );
  const [note, setNote] = useState(''),
    [reference, setReference] = useState('');
  const [today] = useState(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
  );
  const [paidOn, setPaidOn] = useState(today),
    [confirmed, setConfirmed] = useState(false),
    [ack, setAck] = useState(false);
  const [attempt, setAttempt] = useState<WithdrawalAction | null>(null),
    [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const [update, { isLoading }] = useChangeWithdrawalMutation();
  if (['paid', 'rejected', 'cancelled'].includes(withdrawal.status))
    return null;
  const frozen = isLoading || !!attempt;
  const problem = withdrawal.wallet.shortfallPaise > 0;
  const blocked =
    ['approved', 'processing'].includes(action) &&
    (problem || withdrawal.accountChanged);
  const options: WithdrawalAction['action'][] =
    withdrawal.status === 'requested'
      ? ['approved', 'rejected']
      : withdrawal.status === 'processing'
      ? ['paid', 'failed']
      : ['processing', 'cancelled'];
  const reasonRequired = ['rejected', 'cancelled', 'failed'].includes(action);
  async function submit() {
    if (locked.current) return;
    let request = attempt;
    if (!request) {
      if (!confirmed || blocked) return;
      if (reasonRequired && !note.trim()) {
        setError('Enter a reason for this decision.');
        return;
      }
      if (
        action === 'paid' &&
        (!/^[A-Za-z0-9][A-Za-z0-9._/-]{2,99}$/.test(reference.trim()) ||
          !paidOn)
      ) {
        setError('Enter the bank reference and transfer date.');
        return;
      }
      if (action === 'paid' && problem && !ack) return;
      request = {
        requestId: crypto.randomUUID(),
        version: withdrawal.version,
        action,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(action === 'paid'
          ? {
              reference: reference.trim().toUpperCase(),
              paidOn,
              ...(ack ? { acknowledgeChanges: true } : {}),
            }
          : {}),
      };
      setAttempt(request);
    }
    locked.current = true;
    setError(null);
    try {
      await update({
        withdrawalId: withdrawal.id,
        withdrawalAction: request,
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
  return (
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h3>Review and payout</h3>
      <label className="field">
        Action
        <select
          className="input"
          value={action}
          disabled={frozen}
          onChange={(e) => {
            setAction(e.target.value as WithdrawalAction['action']);
            setConfirmed(false);
            setAck(false);
          }}
        >
          {options.map((value) => (
            <option key={value} value={value}>
              {ACTION_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      {action === 'approved' && (
        <p className="hint">
          Approval keeps the amount reserved. It does not mark the request paid
          or initiate a bank transfer.
        </p>
      )}
      {action === 'processing' && (
        <p className="hint">
          Check the saved account and wallet, then make the full{' '}
          {payoutMoney(withdrawal.amountPaise)} transfer outside Dentra. Record
          the bank reference after confirming the transfer.
        </p>
      )}
      {blocked && (
        <p role="alert">
          The bank account changed or the wallet has an earnings adjustment.
          Review the request before approval or processing.
        </p>
      )}
      {action === 'paid' && (
        <>
          <label className="field">
            Bank reference
            <input
              className="input"
              value={reference}
              maxLength={100}
              required
              disabled={frozen}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <label className="field">
            Transfer date (IST)
            <input
              className="input"
              type="date"
              required
              max={today}
              value={paidOn}
              disabled={frozen}
              onChange={(e) => setPaidOn(e.target.value)}
            />
          </label>
          {problem && (
            <label className="row">
              <input
                type="checkbox"
                checked={ack}
                disabled={frozen}
                onChange={(e) => setAck(e.target.checked)}
              />
              I acknowledge the wallet adjustment and am recording a transfer
              that actually occurred.
            </label>
          )}
        </>
      )}
      <label className="field">
        {reasonRequired ? 'Reason' : 'Note (optional)'}
        <textarea
          className="input"
          maxLength={300}
          required={reasonRequired}
          value={note}
          disabled={frozen}
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
              withdrawal.amountPaise,
            )} was transferred to the saved account.`
          : reasonRequired
          ? 'I checked this decision and confirmed no transfer occurred.'
          : 'I checked the request, wallet balance and saved account.'}
      </label>
      {error && <p role="alert">{error}</p>}
      {attempt && !isLoading && (
        <p className="hint">
          The previous result is unconfirmed. Retry the same request to recover
          it safely.
        </p>
      )}
      <button
        className="btn btn-primary"
        disabled={
          isLoading ||
          (!attempt &&
            (!confirmed || blocked || (action === 'paid' && problem && !ack)))
        }
      >
        {isLoading
          ? 'Saving…'
          : attempt
          ? 'Retry same request'
          : 'Save decision'}
      </button>
    </form>
  );
}
