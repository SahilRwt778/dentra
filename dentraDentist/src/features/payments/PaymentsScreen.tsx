import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { StackParamList } from '../../navigation/types';
import { useGetPaymentsQuery } from '../../store/dentraApi';
import { useForegroundRefresh } from '../../common/hooks/useForegroundRefresh';
import { errorMessage } from '../../common/utils/api-error';
import { layout } from '../../common/theme/theme';
import { FormScreen } from '../../components/ui/FormScreen';
import { Button } from '../../components/ui/Button';
import { Empty, Loading } from '../../components/ui/Feedback';
import {
  EMPTY_PAYMENT_FILTERS,
  paymentsQuery,
  type PaymentFilters,
} from './payment-filters';
import { PaymentFiltersCard } from './PaymentFiltersCard';
import { PaymentSummary } from './PaymentSummary';
import { PaymentCard } from './PaymentCard';
import { PAYMENT_STATUSES } from './payment-format';

export function PaymentsScreen({
  navigation,
}: NativeStackScreenProps<StackParamList, 'Payments'>) {
  const [draft, setDraft] = useState(EMPTY_PAYMENT_FILTERS);
  const [applied, setApplied] = useState(EMPTY_PAYMENT_FILTERS);
  const [page, setPage] = useState(1);
  const [filterError, setFilterError] = useState<string | null>(null);
  const focused = useIsFocused();
  const query = useMemo(() => paymentsQuery(applied, page), [applied, page]);
  const result = useGetPaymentsQuery(query, { skip: !focused });
  useForegroundRefresh(result.refetch, focused, 15000);
  function change(changes: Partial<PaymentFilters>) {
    setDraft(current => ({ ...current, ...changes }));
    setFilterError(null);
  }
  function apply() {
    if (draft.from && draft.to && draft.from > draft.to) {
      setFilterError('The start date must be on or before the end date.');
      return;
    }
    setApplied({ ...draft, search: draft.search.trim() });
    setPage(1);
    setFilterError(null);
  }
  function clear() {
    setDraft(EMPTY_PAYMENT_FILTERS);
    setApplied(EMPTY_PAYMENT_FILTERS);
    setPage(1);
    setFilterError(null);
  }
  const data = result.currentData;
  return (
    <FormScreen
      refresh={result.refetch}
      refreshing={result.isFetching && !!data}
    >
      <Text style={layout.muted}>
        Payments for your appointments. View collections, outstanding fees and
        refunds.
      </Text>
      <Button
        title="Wallet"
        variant="secondary"
        onPress={() => navigation.navigate('Wallet')}
      />
      <PaymentFiltersCard
        value={draft}
        change={change}
        apply={apply}
        clear={clear}
        error={filterError}
      />
      {result.error ? (
        <Empty
          title="Could not load payments"
          text={errorMessage(result.error)}
          retry={result.refetch}
        />
      ) : !data ? (
        <Loading text="Loading payments…" />
      ) : (
        <>
          <Text style={layout.muted}>
            {applied.source === 'clinic'
              ? 'At clinic'
              : applied.source === 'online'
              ? 'Online'
              : 'All sources'}{' '}
            ·{' '}
            {applied.status ? PAYMENT_STATUSES[applied.status] : 'All statuses'}{' '}
            · {applied.from || 'Any start date'} –{' '}
            {applied.to || 'Any end date'}
          </Text>
          <PaymentSummary summary={data.summary} />
          <Text style={layout.heading}>Payment history</Text>
          {data.items.length ? (
            data.items.map(payment => (
              <PaymentCard
                key={payment.id}
                payment={payment}
                onPress={() =>
                  navigation.navigate('PaymentReceipt', {
                    transactionId: payment.id,
                  })
                }
              />
            ))
          ) : (
            <Empty
              title={
                data.summary.totalTransactions
                  ? 'No payments on this page'
                  : 'No matching payments'
              }
              text="Try another date, status or source."
            />
          )}
          <Text style={layout.muted}>
            Page {page} · {data.summary.totalTransactions} transactions · Latest
            first
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
