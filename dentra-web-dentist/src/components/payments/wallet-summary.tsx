import { Link } from 'react-router-dom';
import type { DentistWallet } from '@/api/generated-api';
import { rupees } from '@/lib/date';

export function WalletSummary({ wallet }: { wallet: DentistWallet }) {
  return (
    <section className="stack" aria-label="Wallet balance">
      <div className="stats dentist-payment-stats">
        {(
          [
            ['Available balance', wallet.availablePaise],
            ['Withdrawal amount reserved', wallet.reservedPaise],
            ['Total withdrawn', wallet.withdrawnPaise],
            ['Pending earnings', wallet.pendingPaise],
          ] as const
        ).map(([label, value]) => (
          <div className="stat" key={label}>
            <b>{rupees(value)}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>
      {!wallet.configured && (
        <p className="hint">
          Withdrawals will open after admin configures the platform fee and
          minimum amount.
        </p>
      )}
      {wallet.configured && (
        <p className="hint">
          Minimum withdrawal: {rupees(wallet.minimumWithdrawalPaise!)}. The
          current platform fee is {(wallet.feeBps! / 100).toFixed(2)}% for new
          bookings. Fees are already included in these balances.
        </p>
      )}
      {wallet.unpricedCount > 0 && (
        <p className="hint">
          {wallet.unpricedCount} earlier online collections (
          {rupees(wallet.unpricedGrossPaise)} before fees) need a fee assigned
          by admin before they become available.
        </p>
      )}
      {wallet.shortfallPaise > 0 && (
        <p role="alert" className="hint">
          Refund or earnings adjustment: {rupees(wallet.shortfallPaise)}.
          Contact admin to review outstanding withdrawals.
        </p>
      )}
      {wallet.account ? (
        <p className="small muted">
          Approved account ending {wallet.account.last4} · {wallet.account.ifsc}
        </p>
      ) : (
        <p className="hint">
          An approved payout account is required.{' '}
          <Link to="/settings">Manage payout details</Link>
        </p>
      )}
      <p className="hint">
        Completed online consultations become available after their saved
        platform fee. Pay-at-clinic collections are excluded. Requesting a
        withdrawal reserves the amount until admin completes or declines it.
      </p>
    </section>
  );
}
