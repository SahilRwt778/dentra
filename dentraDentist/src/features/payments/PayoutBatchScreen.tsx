import React from 'react';
import { Text } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { StackParamList } from '../../navigation/types';
import { useGetPayoutBatchQuery } from '../../store/dentraApi';
import { useForegroundRefresh } from '../../common/hooks/useForegroundRefresh';
import { errorMessage } from '../../common/utils/api-error';
import { money } from '../../common/utils/date';
import { layout } from '../../common/theme/theme';
import { FormScreen } from '../../components/ui/FormScreen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Empty, Loading } from '../../components/ui/Feedback';
import { SettingsDetail } from '../settings/settings-ui';
import { PAYOUT_STATUSES } from './payout-format';
import { paymentTimestamp } from './payment-format';

export function PayoutBatchScreen({
  navigation,
  route,
}: NativeStackScreenProps<StackParamList, 'PayoutBatch'>) {
  const focused = useIsFocused();
  const result = useGetPayoutBatchQuery(route.params.batchId, {
    skip: !focused,
  });
  useForegroundRefresh(result.refetch, focused, 15000);
  const batch = result.currentData;
  return (
    <FormScreen
      refresh={result.refetch}
      refreshing={result.isFetching && !!batch}
    >
      {result.error ? (
        <Empty
          title="Could not load payout"
          text={errorMessage(result.error)}
          retry={result.refetch}
        />
      ) : !batch ? (
        <Loading text="Loading payout…" />
      ) : (
        <>
          <Card>
            <Text style={layout.title}>{money(batch.netPaise)}</Text>
            <Text style={layout.heading}>{PAYOUT_STATUSES[batch.status]}</Text>
            <SettingsDetail label="Batch" value={batch.id} />
            <SettingsDetail
              label="Gross collections"
              value={money(batch.grossPaise)}
            />
            <SettingsDetail
              label={`Platform fee (${(batch.feeBps / 100).toFixed(2)}%)`}
              value={money(batch.feePaise)}
            />
            <SettingsDetail
              label="Saved account"
              value={`Ending ${batch.accountLast4} · ${batch.bankIfsc}`}
            />
            <SettingsDetail
              label="Created (IST)"
              value={paymentTimestamp(batch.createdAt)}
            />
            {batch.bankReference && (
              <>
                <SettingsDetail
                  label="Bank reference"
                  value={batch.bankReference}
                />
                <SettingsDetail label="Transfer date" value={batch.paidOn} />
              </>
            )}
          </Card>
          <Text style={layout.muted}>
            Paid means an admin recorded the transfer. Bank credit is confirmed
            through your bank.
          </Text>
          {batch.needsAttention && (
            <Text style={layout.muted}>
              A payment in this batch changed. Contact admin to review the
              discrepancy.
            </Text>
          )}
          <Text style={layout.heading}>Included collections</Text>
          {batch.items.map(item => (
            <Card key={item.transactionId}>
              <Text style={layout.heading}>{item.patientName}</Text>
              <Text style={layout.body}>
                Gross {money(item.amountPaise)} · Fee {money(item.feePaise)}
              </Text>
              <Text style={layout.muted}>
                Current payment: {item.paymentStatus.replace(/_/g, ' ')}
                {item.released ? ' · reservation released' : ''}
              </Text>
              <Button
                title="Open appointment"
                variant="secondary"
                onPress={() =>
                  navigation.navigate('Appointment', {
                    appointmentId: item.appointmentId,
                  })
                }
              />
            </Card>
          ))}
          <Card>
            <Text style={layout.heading}>Activity</Text>
            {batch.events.map(event => (
              <Text key={event.id} style={layout.body}>
                {PAYOUT_STATUSES[event.status]} ·{' '}
                {paymentTimestamp(event.createdAt)} IST
                {event.note ? `\n${event.note}` : ''}
              </Text>
            ))}
          </Card>
        </>
      )}
    </FormScreen>
  );
}
