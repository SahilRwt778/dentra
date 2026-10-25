import { useState, type FormEvent } from 'react';
import {
  useGetWalletSettingsQuery,
  useUpdateWalletSettingsMutation,
} from '@/api/wallet';
import {
  feeBasisPoints,
  payoutError,
  payoutMoney,
} from '@/utils/payout-batches';
import { positivePaise } from '@/utils/wallet';
import type { WalletSettings } from '@/api/generated-api';

export function WalletSettingsCard() {
  const result = useGetWalletSettingsQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const [draft, setDraft] = useState<{
    version: number;
    fee: string;
    minimum: string;
    backfill: boolean;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [save, { isLoading }] = useUpdateWalletSettingsMutation();
  function edit(settings: WalletSettings) {
    setDraft({
      version: settings.version,
      fee: settings.feeBps === null ? '' : String(settings.feeBps / 100),
      minimum:
        settings.minimumWithdrawalPaise === null
          ? ''
          : String(settings.minimumWithdrawalPaise / 100),
      backfill: false,
    });
    setMessage(null);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft || isLoading) return;
    const feeBps = feeBasisPoints(draft.fee),
      minimumWithdrawalPaise = positivePaise(draft.minimum);
    if (feeBps === null || feeBps >= 10000 || minimumWithdrawalPaise === null) {
      setMessage(
        'Enter a platform fee from 0 to 99.99% and a positive minimum withdrawal, each with up to two decimal places.',
      );
      return;
    }
    try {
      await save({
        walletSettingsUpdate: {
          version: draft.version,
          feeBps,
          minimumWithdrawalPaise,
          applyToUnpriced: draft.backfill,
        },
      }).unwrap();
      setDraft(null);
      setMessage('Wallet settings saved.');
    } catch (error) {
      setMessage(payoutError(error));
    }
  }
  const data = result.currentData;
  return (
    <section className="card stack" aria-label="Wallet settings">
      <div className="row between">
        <h3>Wallet and withdrawals</h3>
        {data && !result.error && !draft && (
          <button className="btn" onClick={() => edit(data)}>
            Edit wallet settings
          </button>
        )}
      </div>
      <p className="hint">
        One platform fee applies to all dentists’ new online bookings.
        Pay-at-clinic collections stay outside the wallet. Assigned booking fees
        do not change when you update this setting.
      </p>
      {draft ? (
        <form className="stack" onSubmit={submit}>
          <fieldset className="settings-fields stack" disabled={isLoading}>
            <label className="field">
              Platform fee (%)
              <input
                className="input"
                inputMode="decimal"
                required
                value={draft.fee}
                onChange={(e) => setDraft({ ...draft, fee: e.target.value })}
              />
            </label>
            <label className="field">
              Minimum withdrawal (₹)
              <input
                className="input"
                inputMode="decimal"
                required
                value={draft.minimum}
                onChange={(e) =>
                  setDraft({ ...draft, minimum: e.target.value })
                }
              />
            </label>
            {!!data?.unpricedBookings && (
              <label className="row">
                <input
                  type="checkbox"
                  checked={draft.backfill}
                  onChange={(e) =>
                    setDraft({ ...draft, backfill: e.target.checked })
                  }
                />
                Apply this fee to {data.unpricedBookings} earlier online
                bookings that have no assigned fee.
              </label>
            )}
          </fieldset>
          <p className="hint">
            Earlier bookings without an assigned fee remain unavailable for
            withdrawal until you explicitly assign one. Existing assigned rates
            are preserved.
          </p>
          <div className="row">
            <button className="btn btn-primary" disabled={isLoading}>
              {isLoading ? 'Saving…' : 'Save wallet settings'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={isLoading}
              onClick={() => {
                setDraft(null);
                setMessage(null);
                void result.refetch();
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : result.error ? (
        <div role="alert">
          <p>{payoutError(result.error)}</p>
          <button className="btn" onClick={() => void result.refetch()}>
            Try again
          </button>
        </div>
      ) : !data ? (
        <p role="status">Loading wallet settings…</p>
      ) : (
        <dl className="kv">
          <dt>Platform fee</dt>
          <dd>
            {data.feeBps === null
              ? 'Not configured'
              : `${(data.feeBps / 100).toFixed(2)}%`}
          </dd>
          <dt>Minimum withdrawal</dt>
          <dd>
            {data.minimumWithdrawalPaise === null
              ? 'Not configured'
              : payoutMoney(data.minimumWithdrawalPaise)}
          </dd>
          <dt>Unpriced online bookings</dt>
          <dd>{data.unpricedBookings ?? 0}</dd>
        </dl>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
