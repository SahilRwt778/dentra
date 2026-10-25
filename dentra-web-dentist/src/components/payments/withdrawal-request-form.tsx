import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DentistWallet, RequestWithdrawal } from '@/api/generated-api';
import { useRequestDentistWithdrawalMutation } from '@/api/wallet';
import { apiErrorMessage } from '@/lib/api-error';
import { rupees } from '@/lib/date';
import { uncertainWithdrawal, withdrawalPaise } from '@/lib/wallet';

export function WithdrawalRequestForm({
  wallet,
  refresh,
}: {
  wallet: DentistWallet;
  refresh: () => unknown;
}) {
  const navigate = useNavigate();
  const [amount, setAmount] = useState(''),
    [review, setReview] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<RequestWithdrawal | null>(null);
  const [reviewAccount, setReviewAccount] =
    useState<DentistWallet['account']>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const locked = useRef(false);
  const [send, { isLoading }] = useRequestDentistWithdrawalMutation();
  const paise = withdrawalPaise(amount),
    frozen = isLoading || !!attempt;
  const valid =
    wallet.configured &&
    !!wallet.account &&
    paise !== null &&
    paise >= wallet.minimumWithdrawalPaise! &&
    paise <= wallet.availablePaise;
  async function submit() {
    if (locked.current) return;
    if (!review) {
      if (valid) {
        setReviewAccount(wallet.account);
        setReview(true);
        setError(null);
      }
      return;
    }
    let request = attempt;
    if (!request) {
      if (!valid || !reviewAccount || paise === null) return;
      request = {
        requestId: crypto.randomUUID(),
        accountApprovalId: reviewAccount.approvalId,
        amountPaise: paise,
      };
      setAttempt(request);
    }
    locked.current = true;
    setError(null);
    try {
      const withdrawal = await send({ requestWithdrawal: request }).unwrap();
      if (active.current) {
        setAttempt(null);
        navigate(`/wallet/withdrawals/${withdrawal.id}`);
      }
    } catch (e) {
      if (active.current) {
        if (!uncertainWithdrawal(e)) {
          setAttempt(null);
          setReview(false);
          refresh();
        }
        setError(
          apiErrorMessage(
            e,
            'Could not confirm your withdrawal request. Please retry.',
          ),
        );
      }
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
      <h3>{review ? 'Review withdrawal' : 'Request withdrawal'}</h3>
      {review ? (
        <>
          <p className="dentist-payment-detail-amount">{rupees(paise ?? 0)}</p>
          <p>To approved account ending {reviewAccount?.last4}.</p>
          <p className="hint">
            Admin will review this request. The amount will be reserved
            immediately. No additional platform fee is charged on withdrawal.
          </p>
        </>
      ) : (
        <label className="field">
          Amount (₹)
          <input
            className="input"
            inputMode="decimal"
            required
            value={amount}
            disabled={frozen || !wallet.configured || !wallet.account}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
          />
        </label>
      )}
      {!review && amount && !valid && (
        <p className="hint">
          Enter an amount between {rupees(wallet.minimumWithdrawalPaise ?? 0)}{' '}
          and your available balance of {rupees(wallet.availablePaise)}.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {attempt && !isLoading && (
        <p className="hint">
          The result is unconfirmed. Retry the same request to recover it
          safely.
        </p>
      )}
      <div className="row wrap">
        <button
          className="btn btn-primary"
          disabled={isLoading || (!attempt && !valid)}
        >
          {isLoading
            ? 'Submitting…'
            : attempt
            ? 'Retry same request'
            : review
            ? 'Confirm withdrawal request'
            : 'Review withdrawal'}
        </button>
        {review && (
          <button
            type="button"
            className="btn"
            disabled={frozen}
            onClick={() => setReview(false)}
          >
            Edit amount
          </button>
        )}
      </div>
    </form>
  );
}
