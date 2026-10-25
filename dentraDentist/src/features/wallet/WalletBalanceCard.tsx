import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DentistWallet } from '../../common/types/wallet';
import { colors, layout } from '../../common/theme/theme';
import { money } from '../../common/utils/date';
import { Card } from '../../components/ui/Card';

export function WalletBalanceCard({ wallet }: { wallet: DentistWallet }) {
  return (
    <View style={layout.stack}>
      <Card>
        <Text style={layout.muted}>Available balance</Text>
        <Text style={layout.title}>{money(wallet.availablePaise)}</Text>
        <Text style={layout.muted}>
          After saved platform fees and withdrawal reservations
        </Text>
      </Card>
      <View style={styles.grid}>
        {(
          [
            ['Withdrawal amount reserved', wallet.reservedPaise],
            ['Total withdrawn', wallet.withdrawnPaise],
            ['Pending earnings', wallet.pendingPaise],
          ] as const
        ).map(([label, value]) => (
          <View style={styles.stat} key={label}>
            <Text style={layout.heading}>{money(value)}</Text>
            <Text style={layout.muted}>{label}</Text>
          </View>
        ))}
      </View>
      {!wallet.configured ? (
        <Text style={layout.muted}>
          Withdrawals will open after admin configures the platform fee and
          minimum amount.
        </Text>
      ) : (
        <Text style={layout.muted}>
          Minimum withdrawal: {money(wallet.minimumWithdrawalPaise!)}. Current
          fee for new online bookings: {(wallet.feeBps! / 100).toFixed(2)}%.
          Fees are already included in your balance.
        </Text>
      )}
      {wallet.unpricedCount > 0 && (
        <Text style={layout.muted}>
          {wallet.unpricedCount} earlier online collections (
          {money(wallet.unpricedGrossPaise)} before fees) need a fee assigned by
          admin before they become available.
        </Text>
      )}
      {wallet.shortfallPaise > 0 && (
        <Text style={styles.warning}>
          Refund or earnings adjustment: {money(wallet.shortfallPaise)}. Contact
          admin to review outstanding withdrawals.
        </Text>
      )}
      <Text style={layout.muted}>
        Completed online consultations become available after their saved
        platform fee. Pay-at-clinic collections are excluded.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    minWidth: '45%',
    flexBasis: '45%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  warning: { color: colors.danger, fontSize: 14, lineHeight: 21 },
});
