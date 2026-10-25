import React from 'react';
import { Text, View } from 'react-native';
import type { Appointment } from '../../../common/types/api';
import { appointmentStyles as styles } from '../appointment.styles';
import { money } from '../../../common/utils/date';
import { AppointmentDetailRow } from '../AppointmentDetailRow';
import { Button } from '../../../components/ui/Button';
import { ErrorMessage } from '../../../components/ui/Feedback';
import {
  canCollectClinicPayment,
  COLLECTION_METHODS,
  collectionMethodLabel,
  collectionTime,
} from './clinic-payment';
import type { useClinicPayment } from './useClinicPayment';

export function AppointmentPaymentDetails({
  appointment,
  payment,
  disabled,
}: {
  appointment: Appointment;
  payment: ReturnType<typeof useClinicPayment>;
  disabled: boolean;
}) {
  if (!appointment.payment) return null;
  const receipt = appointment.payment.collection;
  return (
    <View style={styles.stack}>
      <AppointmentDetailRow
        label="Payment"
        value={`${money(appointment.payment.amountPaise)} · ${
          receipt
            ? 'Paid at clinic'
            : appointment.payment.status.replace(/_/g, ' ')
        }`}
      />
      {!!payment.notice && (
        <Text accessibilityRole="alert" style={styles.muted}>
          {payment.notice}
        </Text>
      )}
      <ErrorMessage message={payment.error} />
      {receipt && (
        <>
          <Text style={styles.body}>
            {money(receipt.amountPaise)} received by{' '}
            {collectionMethodLabel(receipt.method)}
          </Text>
          <Text style={styles.muted}>
            {collectionTime(receipt.collectedAt)} IST
          </Text>
          <Text selectable style={styles.muted}>
            Receipt: {receipt.id}
          </Text>
          {appointment.status === 'cancelled' && (
            <Text style={styles.muted}>
              For any refund, arrange it directly with the clinic.
            </Text>
          )}
        </>
      )}
      {canCollectClinicPayment(appointment) && (
        <>
          <Text style={styles.label}>Received by</Text>
          <View style={styles.row}>
            {COLLECTION_METHODS.map(item => (
              <View key={item.value} style={styles.grow}>
                <Button
                  title={item.label}
                  accessibilityLabel={`Payment method ${item.label}`}
                  variant={
                    payment.method === item.value ? 'primary' : 'secondary'
                  }
                  disabled={disabled}
                  onPress={() => payment.selectMethod(item.value)}
                />
              </View>
            ))}
          </View>
          <Text style={styles.muted}>
            Record the full consultation fee after receiving it at the clinic.
          </Text>
          <Button
            title="Mark as paid"
            loading={payment.busy}
            disabled={disabled || !payment.method}
            onPress={payment.confirm}
          />
        </>
      )}
    </View>
  );
}
