import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DentistPaymentSummary } from '../../common/types/payments';
import { colors, layout } from '../../common/theme/theme';
import { money } from '../../common/utils/date';
import { SUMMARY_FIELDS } from './payment-format';

export function PaymentSummary({
  summary,
}: {
  summary: DentistPaymentSummary;
}) {
  return (
    <View style={layout.stack}>
      <Text style={layout.heading}>For these filters</Text>
      <View style={styles.grid}>
        {SUMMARY_FIELDS.map(field => (
          <View key={field.key} style={styles.stat}>
            <Text style={styles.amount}>{money(summary[field.key])}</Text>
            <Text style={layout.muted}>{field.label}</Text>
          </View>
        ))}
      </View>
      <Text style={layout.muted}>
        Totals show current payment states, before fees and payouts. Failed
        online attempts remain awaiting payment.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    minWidth: '45%',
    flexGrow: 1,
    flexBasis: '45%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 6,
  },
  amount: { fontSize: 22, fontWeight: '700', color: colors.ink },
});
