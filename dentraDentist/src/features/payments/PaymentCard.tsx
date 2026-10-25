import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { DentistPayment } from '../../common/types/payments';
import { layout } from '../../common/theme/theme';
import { money } from '../../common/utils/date';
import { Card } from '../../components/ui/Card';
import { PaymentStatusBadge } from './PaymentStatusBadge';
import {
  paymentMethod,
  paymentTimestamp,
  PAYMENT_STATUSES,
} from './payment-format';

export function PaymentCard({
  payment,
  onPress,
}: {
  payment: DentistPayment;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${payment.patientName}, ${money(
        payment.amountPaise,
      )}, ${PAYMENT_STATUSES[payment.status]}. View payment details.`}
      onPress={onPress}
    >
      <Card>
        <View style={layout.between}>
          <Text style={[layout.heading, layout.grow]}>
            {payment.patientName}
          </Text>
          <Text style={layout.heading}>{money(payment.amountPaise)}</Text>
        </View>
        <PaymentStatusBadge status={payment.status} />
        <Text style={layout.body}>{paymentMethod(payment)}</Text>
        <Text style={layout.muted}>
          {paymentTimestamp(payment.createdAt)} IST
        </Text>
        <Text style={layout.muted}>View payment details ›</Text>
      </Card>
    </Pressable>
  );
}
