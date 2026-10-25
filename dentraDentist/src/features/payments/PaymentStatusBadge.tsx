import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { PaymentStatus } from '../../common/types/payments';
import { colors } from '../../common/theme/theme';
import { PAYMENT_STATUSES } from './payment-format';

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Text
      style={[
        styles.badge,
        status === 'paid' && styles.paid,
        status === 'refund_failed' && styles.danger,
      ]}
    >
      {PAYMENT_STATUSES[status]}
    </Text>
  );
}
const styles = StyleSheet.create({
  badge: {
    color: colors.amber,
    backgroundColor: colors.amberSoft,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '600',
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  paid: { backgroundColor: colors.primarySoft, color: colors.primary },
  danger: { backgroundColor: colors.dangerSoft, color: colors.danger },
});
