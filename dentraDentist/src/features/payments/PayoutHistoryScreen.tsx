import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { StackParamList } from '../../navigation/types';
import type { PayoutBatchStatus } from '../../common/types/payout-batch';
import { useGetPayoutBatchesQuery } from '../../store/dentraApi';
import { useForegroundRefresh } from '../../common/hooks/useForegroundRefresh';
import { errorMessage } from '../../common/utils/api-error';
import { money } from '../../common/utils/date';
import { layout } from '../../common/theme/theme';
import { FormScreen } from '../../components/ui/FormScreen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Empty, Loading } from '../../components/ui/Feedback';
import { PAYOUT_STATUSES } from './payout-format';
import { paymentTimestamp } from './payment-format';

export function PayoutHistoryScreen({
  navigation,
}: NativeStackScreenProps<StackParamList, 'PayoutHistory'>) {
  const [status, setStatus] = useState<PayoutBatchStatus | ''>('');
  const [page, setPage] = useState(1);
  const focused = useIsFocused();
  const query = useMemo(
    () => ({ page, limit: 20, status: status || undefined }),
    [page, status],
  );
  const result = useGetPayoutBatchesQuery(query, { skip: !focused });
  useForegroundRefresh(result.refetch, focused, 15000);
  const data = result.currentData;
  return (
    <FormScreen
      refresh={result.refetch}
      refreshing={result.isFetching && !!data}
    >
      <Text style={layout.muted}>
        Track online collections reserved for payout and bank transfers recorded
        by admin.
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={layout.row}
      >
        {(
          [['', 'All statuses'], ...Object.entries(PAYOUT_STATUSES)] as [
            PayoutBatchStatus | '',
            string,
          ][]
        ).map(([value, label]) => (
          <Button
            key={value}
            title={label}
            variant={status === value ? 'primary' : 'secondary'}
            onPress={() => {
              setStatus(value);
              setPage(1);
            }}
          />
        ))}
      </ScrollView>
      {result.error ? (
        <Empty
          title="Could not load payouts"
          text={errorMessage(result.error)}
          retry={result.refetch}
        />
      ) : !data ? (
        <Loading text="Loading payouts…" />
      ) : (
        <>
          <Card>
            <Text style={layout.heading}>For these filters</Text>
            <Text style={layout.body}>
              Reserved: {money(data.reservedPaise)}
            </Text>
            <Text style={layout.body}>
              Recorded paid: {money(data.paidPaise)}
            </Text>
          </Card>
          <Text style={layout.muted}>
            Batches include completed online consultations after the agreed
            platform fee. Clinic collections are received directly by your
            clinic.
          </Text>
          {data.items.length ? (
            data.items.map(batch => (
              <Card key={batch.id}>
                <View style={layout.between}>
                  <Text style={layout.heading}>{money(batch.netPaise)}</Text>
                  <Text style={layout.body}>
                    {PAYOUT_STATUSES[batch.status]}
                  </Text>
                </View>
                <Text style={layout.muted}>
                  {paymentTimestamp(batch.createdAt)} IST
                </Text>
                <Text style={layout.body}>
                  Gross {money(batch.grossPaise)} · Fee {money(batch.feePaise)}
                </Text>
                <Text style={layout.muted}>
                  Account ending {batch.accountLast4}
                </Text>
                {batch.needsAttention && (
                  <Text style={layout.muted}>
                    Payment discrepancy · contact admin
                  </Text>
                )}
                <Button
                  title="View payout"
                  variant="secondary"
                  onPress={() =>
                    navigation.navigate('PayoutBatch', { batchId: batch.id })
                  }
                />
              </Card>
            ))
          ) : (
            <Empty
              title="No payouts for these filters"
              text="Admin-created batches will appear here."
            />
          )}
          <Text style={layout.muted}>
            Page {page} · {data.total} batches
          </Text>
          <View style={layout.row}>
            <View style={layout.grow}>
              <Button
                title="Previous page"
                variant="secondary"
                disabled={page === 1 || result.isFetching}
                onPress={() => setPage(current => current - 1)}
              />
            </View>
            <View style={layout.grow}>
              <Button
                title="Next page"
                variant="secondary"
                disabled={!data.nextPage || result.isFetching}
                onPress={() => setPage(data.nextPage!)}
              />
            </View>
          </View>
        </>
      )}
    </FormScreen>
  );
}
