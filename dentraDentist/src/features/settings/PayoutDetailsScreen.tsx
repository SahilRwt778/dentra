import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import {
  CheckCircle2,
  Clock3,
  Landmark,
  ShieldCheck,
  ShieldX,
} from 'lucide-react-native';
import {
  useGetPayoutProfileQuery,
  useSubmitPayoutMutation,
} from '../../store/dentraApi';
import type {
  PayoutDetails,
  PayoutProfile,
  PayoutRequest,
} from '../../common/types/settings';
import { useForegroundRefresh } from '../../common/hooks/useForegroundRefresh';
import { useScreenActive } from '../../common/hooks/useScreenActive';
import { colors, layout } from '../../common/theme/theme';
import { errorMessage } from '../../common/utils/api-error';
import { Field } from '../../components/forms/Field';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ErrorMessage, Loading } from '../../components/ui/Feedback';
import { payoutForm, payoutSubmission } from './settings-validation';
import { SettingsDetail, SettingsLayout, settingsStyles } from './settings-ui';

function AccountDetails({ account }: { account: PayoutDetails }) {
  return (
    <>
      <SettingsDetail
        label="Account holder"
        value={account.bankAccountHolder}
      />
      <SettingsDetail label="Account number" value={account.bankAccountNo} />
      <SettingsDetail label="IFSC" value={account.bankIfsc} />
      <SettingsDetail label="PAN" value={account.pan} />
      <SettingsDetail label="GSTIN" value={account.gstin} />
    </>
  );
}

function RequestStatus({ request }: { request: PayoutRequest }) {
  const pending = request.status === 'pending';
  const Icon = pending ? Clock3 : ShieldX;
  return (
    <Card
      style={[settingsStyles.card, pending ? styles.pending : styles.rejected]}
    >
      <View style={layout.row}>
        <Icon size={22} color={pending ? colors.amber : colors.danger} />
        <Text style={settingsStyles.heading}>
          {pending ? 'Awaiting admin approval' : 'Request rejected'}
        </Text>
      </View>
      <Text style={settingsStyles.description}>
        {pending
          ? 'Your payout details have been sent to admin. Please wait until they are verified.'
          : request.rejectionReason ||
            'Please correct your details and submit again.'}
      </Text>
      {pending && <AccountDetails account={request} />}
      <Text style={styles.date}>
        Submitted{' '}
        {new Date(request.submittedAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'Asia/Kolkata',
        })}
      </Text>
    </Card>
  );
}

export function PayoutDetailsScreen() {
  const focused = useIsFocused();
  const {
    currentData: data,
    error,
    isFetching,
    refetch,
  } = useGetPayoutProfileQuery(undefined, { skip: !focused });
  // Keep the exact request/version seen when editing began, even after a refresh.
  const [editing, setEditing] = useState<PayoutProfile | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const active = useScreenActive();
  useForegroundRefresh(refetch, focused && !editing, 15000);
  function finishEditing(message?: string) {
    if (active.current) {
      setEditing(null);
      setActionError(message ?? null);
      refetch();
    }
  }
  if (editing) return <PayoutEditor profile={editing} onDone={finishEditing} />;
  const pending = data?.request?.status === 'pending';
  const actionTitle =
    data?.request?.status === 'rejected'
      ? 'Update and resubmit'
      : data?.approved
      ? 'Update payout details'
      : 'Add payout details';
  return (
    <SettingsLayout
      refresh={refetch}
      refreshing={isFetching && !!data}
      footer={
        data &&
        (pending ? (
          <Button
            title="Refresh status"
            variant="secondary"
            loading={isFetching}
            onPress={refetch}
          />
        ) : (
          <Button
            title={actionTitle}
            disabled={isFetching || !!error}
            onPress={() => setEditing(data)}
          />
        ))
      }
    >
      <Text style={settingsStyles.description}>
        Manage your bank and tax details. Admin approval is required before a
        new account becomes active.
      </Text>
      <ErrorMessage message={actionError} />
      {error && (
        <>
          <ErrorMessage message={errorMessage(error)} />
          <Button
            title="Try again"
            variant="secondary"
            loading={isFetching}
            onPress={refetch}
          />
        </>
      )}
      {!data && !error && <Loading text="Loading payout details…" />}
      {data?.approved && (
        <Card style={settingsStyles.card}>
          <View style={layout.row}>
            <CheckCircle2 size={21} color={colors.primary} />
            <Text style={settingsStyles.heading}>Approved payout account</Text>
          </View>
          <AccountDetails account={data.approved} />
        </Card>
      )}
      {data?.request && data.request.status !== 'approved' && (
        <RequestStatus request={data.request} />
      )}
      {data && !data.approved && !data.request && (
        <Card style={[settingsStyles.card, styles.empty]}>
          <View style={styles.emptyIcon}>
            <Landmark size={30} color={colors.primary} />
          </View>
          <Text style={settingsStyles.heading}>Add your payout account</Text>
          <Text style={styles.emptyText}>
            Submit your bank account, IFSC and PAN for admin verification.
          </Text>
        </Card>
      )}
      {data?.approved && pending && (
        <View style={settingsStyles.note}>
          <ShieldCheck size={19} color={colors.primary} />
          <Text style={settingsStyles.noteText}>
            Your current approved account stays active while the new details are
            reviewed.
          </Text>
        </View>
      )}
    </SettingsLayout>
  );
}

function PayoutEditor({
  profile,
  onDone,
}: {
  profile: PayoutProfile;
  onDone: (message?: string) => void;
}) {
  const [form, setForm] = useState(() => payoutForm(profile));
  const [error, setError] = useState<string | null>(null);
  const [submit, saving] = useSubmitPayoutMutation();
  const active = useScreenActive();
  const lock = useRef(false);
  async function save() {
    if (lock.current) return;
    lock.current = true;
    setError(null);
    try {
      await submit(
        payoutSubmission(form, profile.request?.id ?? null),
      ).unwrap();
      if (active.current) onDone();
    } catch (failure) {
      if (!active.current) return;
      if ((failure as { status?: number }).status === 409)
        onDone(errorMessage(failure));
      else setError(errorMessage(failure));
    } finally {
      lock.current = false;
      saving.reset();
    }
  }
  return (
    <SettingsLayout
      footer={
        <>
          <Button
            title="Submit for approval"
            loading={saving.isLoading}
            onPress={save}
          />
          <Button
            title="Cancel"
            variant="secondary"
            disabled={saving.isLoading}
            onPress={() => onDone()}
          />
        </>
      }
    >
      <Card style={settingsStyles.card}>
        <Text style={settingsStyles.heading}>Bank account</Text>
        <Field
          label="Account holder name"
          value={form.bankAccountHolder}
          maxLength={120}
          autoComplete="off"
          editable={!saving.isLoading}
          onChangeText={bankAccountHolder =>
            setForm(current => ({ ...current, bankAccountHolder }))
          }
        />
        <Field
          label="Account number"
          value={form.bankAccountNo}
          keyboardType="number-pad"
          autoComplete="off"
          maxLength={20}
          editable={!saving.isLoading}
          onChangeText={bankAccountNo =>
            setForm(current => ({ ...current, bankAccountNo }))
          }
        />
        <Field
          label="Confirm account number"
          value={form.confirmAccountNo}
          keyboardType="number-pad"
          autoComplete="off"
          maxLength={20}
          editable={!saving.isLoading}
          onChangeText={confirmAccountNo =>
            setForm(current => ({ ...current, confirmAccountNo }))
          }
        />
        <Field
          label="IFSC"
          value={form.bankIfsc}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={11}
          editable={!saving.isLoading}
          onChangeText={bankIfsc =>
            setForm(current => ({
              ...current,
              bankIfsc: bankIfsc.toUpperCase(),
            }))
          }
        />
      </Card>
      <Card style={settingsStyles.card}>
        <Text style={settingsStyles.heading}>Tax details</Text>
        <Field
          label="PAN"
          value={form.pan}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={10}
          editable={!saving.isLoading}
          onChangeText={pan =>
            setForm(current => ({ ...current, pan: pan.toUpperCase() }))
          }
        />
        <Field
          label="GSTIN (optional)"
          value={form.gstin}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={15}
          editable={!saving.isLoading}
          onChangeText={gstin =>
            setForm(current => ({ ...current, gstin: gstin.toUpperCase() }))
          }
        />
      </Card>
      <View style={settingsStyles.note}>
        <ShieldCheck size={19} color={colors.primary} />
        <Text style={settingsStyles.noteText}>
          These details will be sent to admin. Your existing approved account
          stays active until the change is approved.
        </Text>
      </View>
      <ErrorMessage message={error} />
    </SettingsLayout>
  );
}
const styles = StyleSheet.create({
  pending: { backgroundColor: colors.amberSoft, borderColor: '#E8D8AE' },
  rejected: { backgroundColor: colors.dangerSoft, borderColor: '#EFC4C1' },
  date: { fontSize: 12, color: colors.muted },
  empty: { alignItems: 'center', paddingVertical: 28 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
