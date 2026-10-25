import React, { useRef, useState } from 'react';
import { Alert, Text } from 'react-native';
import { useIsFocused, usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { StackParamList } from '../../navigation/types';
import type {
  DentistWallet,
  RequestWithdrawal,
} from '../../common/types/wallet';
import {
  useGetWalletQuery,
  useRequestWithdrawalMutation,
} from '../../store/dentraApi';
import { useScreenActive } from '../../common/hooks/useScreenActive';
import { errorMessage } from '../../common/utils/api-error';
import { createRequestId } from '../../common/utils/request-id';
import { money } from '../../common/utils/date';
import { layout } from '../../common/theme/theme';
import { FormScreen } from '../../components/ui/FormScreen';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/forms/Field';
import { Empty, ErrorMessage, Loading } from '../../components/ui/Feedback';
import { withdrawalPaise } from './wallet-format';

export function RequestWithdrawalScreen({
  navigation,
}: NativeStackScreenProps<StackParamList, 'RequestWithdrawal'>) {
  const focused = useIsFocused(),
    active = useScreenActive();
  const result = useGetWalletQuery(undefined, { skip: !focused });
  const [amount, setAmount] = useState(''),
    [review, setReview] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<RequestWithdrawal | null>(null);
  const locked = useRef(false);
  const [reviewAccount, setReviewAccount] =
    useState<DentistWallet['account']>(null);
  const [send, { isLoading }] = useRequestWithdrawalMutation();
  usePreventRemove(isLoading, () =>
    Alert.alert(
      'Request in progress',
      'Please wait while your withdrawal request is confirmed.',
    ),
  );
  const wallet = result.currentData,
    paise = withdrawalPaise(amount),
    frozen = isLoading || !!attempt;
  const valid =
    !!wallet?.configured &&
    !!wallet.account &&
    paise !== null &&
    paise >= wallet.minimumWithdrawalPaise! &&
    paise <= wallet.availablePaise;
  async function submit() {
    if (locked.current) return;
    if (!review) {
      if (valid && wallet) {
        setReviewAccount(wallet.account);
        setReview(true);
        setError(null);
      }
      return;
    }
    let request = attempt;
    if (!request) {
      if (!valid || !reviewAccount || paise === null) return;
      request = {
        requestId: createRequestId(),
        amountPaise: paise,
        accountApprovalId: reviewAccount.approvalId,
      };
      setAttempt(request);
    }
    locked.current = true;
    setError(null);
    try {
      const response = await send(request).unwrap();
      if (active.current) {
        setAttempt(null);
        setReview(false);
        setAmount('');
        navigation.navigate('Withdrawal', { withdrawalId: response.id });
      }
    } catch (e) {
      if (active.current) {
        const status = (e as { status?: number }).status;
        if (status !== undefined && status < 500) {
          setAttempt(null);
          setReview(false);
          result.refetch();
        }
        setError(errorMessage(e));
      }
    } finally {
      locked.current = false;
    }
  }
  if (result.error)
    return (
      <FormScreen>
        <Empty
          title="Could not load wallet"
          text={errorMessage(result.error)}
          retry={result.refetch}
        />
      </FormScreen>
    );
  if (!wallet)
    return (
      <FormScreen>
        <Loading text="Loading wallet…" />
      </FormScreen>
    );
  const displayedAccount = review ? reviewAccount : wallet.account;
  return (
    <FormScreen
      footer={
        <>
          <Button
            title={
              attempt
                ? 'Retry same request'
                : review
                ? 'Confirm withdrawal request'
                : 'Review withdrawal'
            }
            loading={isLoading}
            disabled={!attempt && !valid}
            onPress={submit}
          />
          {review && (
            <Button
              title="Edit amount"
              variant="secondary"
              disabled={frozen}
              onPress={() => setReview(false)}
            />
          )}
        </>
      }
    >
      <Card>
        <Text style={layout.heading}>
          Available: {money(wallet.availablePaise)}
        </Text>
        <Text style={layout.muted}>
          Minimum withdrawal:{' '}
          {wallet.minimumWithdrawalPaise === null
            ? 'Not configured'
            : money(wallet.minimumWithdrawalPaise)}
        </Text>
        {displayedAccount && (
          <Text style={layout.body}>
            Approved account ending {displayedAccount.last4} ·{' '}
            {displayedAccount.ifsc}
          </Text>
        )}
      </Card>
      {!wallet.configured && (
        <Text style={layout.muted}>
          Admin must configure the platform fee and minimum withdrawal first.
        </Text>
      )}
      {!wallet.account && (
        <Text style={layout.muted}>
          An approved payout account is required before requesting a withdrawal.
        </Text>
      )}
      {review ? (
        <Card>
          <Text style={layout.heading}>Review withdrawal</Text>
          <Text style={layout.title}>{money(paise ?? 0)}</Text>
          <Text style={layout.body}>
            Admin will review this request. The amount will be reserved
            immediately. No additional platform fee is charged on withdrawal.
          </Text>
        </Card>
      ) : (
        <Field
          label="Amount (₹)"
          keyboardType="decimal-pad"
          value={amount}
          editable={!frozen && wallet.configured && !!wallet.account}
          onChangeText={value => {
            setAmount(value);
            setError(null);
          }}
        />
      )}
      {!review && amount && !valid && (
        <Text style={layout.muted}>
          Enter an amount between the minimum withdrawal and your available
          balance, with up to two decimal places.
        </Text>
      )}
      <ErrorMessage message={error} />
      {attempt && !isLoading && (
        <Text style={layout.muted}>
          The result is unconfirmed. Retry the same request to recover it
          safely.
        </Text>
      )}
    </FormScreen>
  );
}
