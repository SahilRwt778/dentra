import React from 'react';
import { Text } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { StackParamList } from '../../navigation/types';
import { useGetWithdrawalQuery } from '../../store/dentraApi';
import { useForegroundRefresh } from '../../common/hooks/useForegroundRefresh';
import { errorMessage } from '../../common/utils/api-error';
import { money } from '../../common/utils/date';
import { layout } from '../../common/theme/theme';
import { FormScreen } from '../../components/ui/FormScreen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Empty, Loading } from '../../components/ui/Feedback';
import { SettingsDetail } from '../settings/settings-ui';
import { paymentTimestamp } from '../payments/payment-format';
import { WITHDRAWAL_STATUSES } from './wallet-format';

export function WithdrawalScreen({
  navigation,
  route,
}: NativeStackScreenProps<StackParamList, 'Withdrawal'>) {
  const focused = useIsFocused(),
    result = useGetWithdrawalQuery(route.params.withdrawalId, {
      skip: !focused,
    });
  useForegroundRefresh(result.refetch, focused, 15000);
  const w = result.currentData;
  return (
    <FormScreen refresh={result.refetch} refreshing={result.isFetching && !!w}>
      {result.error ? (
        <Empty
          title="Could not load withdrawal"
          text={errorMessage(result.error)}
          retry={result.refetch}
        />
      ) : !w ? (
        <Loading text="Loading withdrawal…" />
      ) : (
        <>
          <Card>
            <Text style={layout.title}>{money(w.amountPaise)}</Text>
            <Text style={layout.heading}>{WITHDRAWAL_STATUSES[w.status]}</Text>
            <SettingsDetail label="Reference" value={w.id} />
            <SettingsDetail
              label="Requested (IST)"
              value={paymentTimestamp(w.createdAt)}
            />
            <SettingsDetail
              label="Saved account"
              value={`Ending ${w.accountLast4} · ${w.bankIfsc}`}
            />
            {w.bankReference && (
              <>
                <SettingsDetail
                  label="Bank reference"
                  value={w.bankReference}
                />
                <SettingsDetail label="Transfer date" value={w.paidOn} />
              </>
            )}
          </Card>
          <Text style={layout.muted}>
            Approval keeps the amount reserved until payment is completed.
            Declined or cancelled requests release it back to your wallet. Paid
            means admin recorded the transfer; confirm credit through your bank.
          </Text>
          {w.accountChanged && (
            <Text style={layout.muted}>
              Your approved payout account changed after this request. Contact
              admin before the transfer is processed.
            </Text>
          )}
          <Card>
            <Text style={layout.heading}>History</Text>
            {w.events.map(event => (
              <Text key={event.id} style={layout.body}>
                {WITHDRAWAL_STATUSES[event.status]} ·{' '}
                {paymentTimestamp(event.createdAt)} IST
                {event.note ? `\n${event.note}` : ''}
              </Text>
            ))}
          </Card>
          <Button
            title="Open wallet"
            variant="secondary"
            onPress={() => navigation.navigate('Wallet')}
          />
        </>
      )}
    </FormScreen>
  );
}
