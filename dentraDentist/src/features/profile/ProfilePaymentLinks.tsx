import React from 'react';
import { StyleSheet } from 'react-native';
import { FileText, Landmark, Wallet } from 'lucide-react-native';
import type { PayoutProfile } from '../../common/types/settings';
import { Card } from '../../components/ui/Card';
import { ProfileLink } from './ProfileLink';

export function ProfilePaymentLinks({
  payout,
  payoutError,
  onPayments,
  onWallet,
  onPayoutDetails,
}: {
  payout?: PayoutProfile;
  payoutError: boolean;
  onPayments: () => void;
  onWallet: () => void;
  onPayoutDetails: () => void;
}) {
  const status = payout?.request?.status;
  const description = payoutDescription(payout, payoutError);

  return (
    <Card style={styles.card}>
      <ProfileLink
        title="Payments"
        description="Online payments and clinic collections"
        label="View Payments"
        icon={FileText}
        onPress={onPayments}
      />
      <ProfileLink
        title="Wallet"
        description="Balance, withdrawals and history"
        label="Open Wallet"
        icon={Wallet}
        onPress={onWallet}
        divider
      />
      <ProfileLink
        title="Payout details"
        description={description}
        label="Manage Payout details"
        icon={Landmark}
        onPress={onPayoutDetails}
        divider
        tone={
          payoutError || status === 'rejected'
            ? 'danger'
            : status === 'pending'
            ? 'warning'
            : undefined
        }
      />
    </Card>
  );
}

function payoutDescription(payout: PayoutProfile | undefined, failed: boolean) {
  if (failed) return 'Could not load payout status';
  if (!payout) return 'Checking payout details…';
  if (payout.request?.status === 'pending') return 'Awaiting admin approval';
  if (payout.request?.status === 'rejected')
    return 'Request rejected. Open to review and resubmit.';
  if (!payout.approved) return 'Add your bank account for withdrawals';
  const lastFour = payout.approved.bankAccountNo?.slice(-4);
  return lastFour
    ? `Approved account · Ending ${lastFour}`
    : 'Approved payout account';
}

const styles = StyleSheet.create({
  card: { padding: 0, gap: 0, borderRadius: 14, overflow: 'hidden' },
});
