import React from 'react';
import { Text, View } from 'react-native';
import { Clock3, ShieldX } from 'lucide-react-native';
import type { Dentist } from '../../common/types/api';
import { colors, layout } from '../../common/theme/theme';
import { Brand } from '../../components/icons/Brand';
import { Card } from '../../components/ui/Card';
import { FormScreen } from '../../components/ui/Screen';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/Feedback';
import { useAuth } from '../auth/AuthProvider';
const copy = {
  pending_review: {
    title: 'Waiting for admin verification',
    body: 'Your request has been sent to the admin. Please wait while your details and documents are verified. Your appointments will be available once your application is approved.',
  },
  rejected: {
    title: 'Application rejected',
    body: 'The admin has rejected your application. Contact the Dentra team if you need help with the decision.',
  },
  disabled: {
    title: 'Account disabled',
    body: 'Your account has been disabled. Contact the Dentra team for assistance.',
  },
};
export function AccountStatusScreen({
  dentist,
  refreshing,
  refresh,
  error,
}: {
  dentist: Dentist;
  refreshing: boolean;
  refresh: () => void;
  error?: string | null;
}) {
  const { signOut } = useAuth();
  const details =
    copy[dentist.status as keyof typeof copy] ?? copy.pending_review;
  const rejected =
    dentist.status === 'rejected' || dentist.status === 'disabled';
  const Icon = rejected ? ShieldX : Clock3;
  return (
    <FormScreen>
      <Brand />
      <Card>
        <Icon size={44} color={rejected ? colors.danger : colors.primary} />
        <Text style={layout.title}>{details.title}</Text>
        <Text style={layout.body}>{details.body}</Text>
        {dentist.status === 'rejected' && dentist.rejectionReason && (
          <ErrorMessage message={dentist.rejectionReason} />
        )}
        <View>
          <Text style={layout.label}>{dentist.fullName}</Text>
          <Text style={layout.muted}>{dentist.mobile}</Text>
        </View>
        <ErrorMessage message={error} />
        <Button
          title="Check application status"
          loading={refreshing}
          onPress={refresh}
        />
        <Text style={layout.muted}>
          This page also checks for updates while the app is open.
        </Text>
      </Card>
      <Button
        title="Log out"
        variant="secondary"
        onPress={() => {
          signOut().catch(() => {});
        }}
      />
    </FormScreen>
  );
}
