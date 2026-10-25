import React from 'react';
import { Text } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { StackParamList } from '../../navigation/types';
import { useGetPaymentQuery } from '../../store/dentraApi';
import { useForegroundRefresh } from '../../common/hooks/useForegroundRefresh';
import { errorMessage } from '../../common/utils/api-error';
import { formatDate, formatTime, money } from '../../common/utils/date';
import { layout } from '../../common/theme/theme';
import { FormScreen } from '../../components/ui/FormScreen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Empty, Loading } from '../../components/ui/Feedback';
import { SettingsDetail } from '../settings/settings-ui';
import { PaymentStatusBadge } from './PaymentStatusBadge';
import { paymentMethod, paymentTimestamp } from './payment-format';

export function PaymentReceiptScreen({
  route,
  navigation,
}: NativeStackScreenProps<StackParamList, 'PaymentReceipt'>) {
  const focused = useIsFocused();
  const result = useGetPaymentQuery(route.params.transactionId, {
    skip: !focused,
  });
  useForegroundRefresh(result.refetch, focused, 15000);
  const payment = result.currentData;
  return (
    <FormScreen
      refresh={result.refetch}
      refreshing={result.isFetching && !!payment}
    >
      {result.error ? (
        <Empty
          title="Could not load payment"
          text={errorMessage(result.error)}
          retry={result.refetch}
        />
      ) : !payment ? (
        <Loading text="Loading payment…" />
      ) : (
        <>
          <Card>
            <Text style={layout.heading}>{payment.patientName}</Text>
            <Text style={layout.title}>{money(payment.amountPaise)}</Text>
            <PaymentStatusBadge status={payment.status} />
            <Text style={layout.body}>{paymentMethod(payment)}</Text>
            <SettingsDetail
              label="Transaction date"
              value={`${paymentTimestamp(payment.createdAt)} IST`}
            />
            <Text style={layout.label}>Transaction reference</Text>
            <Text selectable style={layout.body}>
              {payment.id}
            </Text>
          </Card>
          {payment.collection && (
            <Card>
              <Text style={layout.heading}>Clinic receipt</Text>
              <SettingsDetail
                label="Received"
                value={money(payment.collection.amountPaise)}
              />
              <SettingsDetail
                label="Collected on"
                value={`${paymentTimestamp(
                  payment.collection.collectedAt,
                )} IST`}
              />
              <Text style={layout.label}>Receipt reference</Text>
              <Text selectable style={layout.body}>
                {payment.collection.id}
              </Text>
            </Card>
          )}
          {(payment.gatewayOrderId ||
            payment.gatewayPaymentId ||
            payment.gatewayRefundId) && (
            <Card>
              <Text style={layout.heading}>Online references</Text>
              {payment.gatewayOrderId && (
                <SettingsDetail label="Order" value={payment.gatewayOrderId} />
              )}
              {payment.gatewayPaymentId && (
                <SettingsDetail
                  label="Payment"
                  value={payment.gatewayPaymentId}
                />
              )}
              {payment.gatewayRefundId && (
                <SettingsDetail
                  label="Refund"
                  value={payment.gatewayRefundId}
                />
              )}
            </Card>
          )}
          <Card>
            <Text style={layout.heading}>Appointment</Text>
            <SettingsDetail
              label="When"
              value={`${formatDate(payment.appointmentDate)} · ${formatTime(
                payment.appointmentTime,
              )}`}
            />
            <SettingsDetail
              label="Visit"
              value={
                payment.appointmentType === 'video'
                  ? 'Video consultation'
                  : payment.clinicName ?? 'In-clinic visit'
              }
            />
            <SettingsDetail
              label="Status"
              value={payment.appointmentStatus.replace(/_/g, ' ')}
            />
            <Button
              title="Open appointment"
              variant="secondary"
              onPress={() =>
                navigation.navigate('Appointment', {
                  appointmentId: payment.appointmentId,
                })
              }
            />
          </Card>
          {payment.source === 'clinic' &&
            payment.appointmentStatus === 'cancelled' &&
            payment.status === 'paid' && (
              <Text style={layout.muted}>
                This payment was received at the clinic. Any refund is arranged
                directly with the clinic.
              </Text>
            )}
          <Text style={layout.muted}>
            This view records payment status. It does not confirm a bank payout.
          </Text>
        </>
      )}
    </FormScreen>
  );
}
