import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { StackParamList } from '../../navigation/types';
import type { WithdrawalStatus } from '../../common/types/wallet';
import {
  useGetWalletQuery,
  useGetWithdrawalsQuery,
} from '../../store/dentraApi';
import { useForegroundRefresh } from '../../common/hooks/useForegroundRefresh';
import { errorMessage } from '../../common/utils/api-error';
import { money } from '../../common/utils/date';
import { layout } from '../../common/theme/theme';
import { FormScreen } from '../../components/ui/FormScreen';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Empty, Loading } from '../../components/ui/Feedback';
import { paymentTimestamp } from '../payments/payment-format';
import { WITHDRAWAL_STATUSES } from './wallet-format';
import { WalletBalanceCard } from './WalletBalanceCard';

export function WalletScreen({
  navigation,
}: NativeStackScreenProps<StackParamList, 'Wallet'>) {
  const focused = useIsFocused();
  const [page, setPage] = useState(1),
    [status, setStatus] = useState<WithdrawalStatus | ''>('');
  const query = useMemo(
    () => ({ page, limit: 20, status: status || undefined }),
    [page, status],
  );
  const result = useGetWalletQuery(undefined, { skip: !focused }),
    history = useGetWithdrawalsQuery(query, { skip: !focused });
  useForegroundRefresh(result.refetch, focused, 15000);
  useForegroundRefresh(history.refetch, focused, 15000);
  function refresh() {
    result.refetch();
    history.refetch();
  }
  const wallet = result.currentData,
    data = history.currentData;
  return (
    <FormScreen refresh={refresh} refreshing={result.isFetching && !!wallet}>
      {result.error ? (
        <Empty
          title="Could not load wallet"
          text={errorMessage(result.error)}
          retry={result.refetch}
        />
      ) : !wallet ? (
        <Loading text="Loading wallet…" />
      ) : (
        <>
          <WalletBalanceCard wallet={wallet} />
          {wallet.account ? (
            <Text style={layout.muted}>
              Approved account ending {wallet.account.last4} ·{' '}
              {wallet.account.ifsc}
            </Text>
          ) : (
            <Button
              title="Manage payout details"
              variant="secondary"
              onPress={() => navigation.navigate('PayoutDetails')}
            />
          )}
          <Button
            title="Request withdrawal"
            disabled={
              !wallet.configured ||
              !wallet.account ||
              wallet.availablePaise < (wallet.minimumWithdrawalPaise ?? 1)
            }
            onPress={() => navigation.navigate('RequestWithdrawal')}
          />
        </>
      )}
      <Text style={layout.heading}>Withdrawal history</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={layout.row}
      >
        {(
          [['', 'All statuses'], ...Object.entries(WITHDRAWAL_STATUSES)] as [
            WithdrawalStatus | '',
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
      {history.error ? (
        <Empty
          title="Could not load withdrawal history"
          text={errorMessage(history.error)}
          retry={history.refetch}
        />
      ) : !data ? (
        <Loading text="Loading withdrawal history…" />
      ) : (
        <>
          {data.items.length ? (
            data.items.map(w => (
              <Card key={w.id}>
                <View style={layout.between}>
                  <Text style={layout.heading}>{money(w.amountPaise)}</Text>
                  <Text style={layout.body}>
                    {WITHDRAWAL_STATUSES[w.status]}
                  </Text>
                </View>
                <Text style={layout.muted}>
                  {paymentTimestamp(w.createdAt)} IST
                </Text>
                <Text style={layout.muted}>
                  Account ending {w.accountLast4}
                </Text>
                <Button
                  title="View withdrawal"
                  variant="secondary"
                  onPress={() =>
                    navigation.navigate('Withdrawal', { withdrawalId: w.id })
                  }
                />
              </Card>
            ))
          ) : (
            <Empty
              title="No withdrawals for these filters"
              text="Your requests and admin decisions will appear here."
            />
          )}
          <Text style={layout.muted}>
            Page {page} · {data.total} requests
          </Text>
          <View style={layout.row}>
            <View style={layout.grow}>
              <Button
                title="Previous page"
                variant="secondary"
                disabled={page === 1 || history.isFetching}
                onPress={() => setPage(current => current - 1)}
              />
            </View>
            <View style={layout.grow}>
              <Button
                title="Next page"
                variant="secondary"
                disabled={!data.nextPage || history.isFetching}
                onPress={() => setPage(data.nextPage!)}
              />
            </View>
          </View>
        </>
      )}
      <Button
        title="Earlier payout batches"
        variant="secondary"
        onPress={() => navigation.navigate('PayoutHistory')}
      />
    </FormScreen>
  );
}
