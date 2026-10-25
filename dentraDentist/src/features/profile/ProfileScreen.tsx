import { workingDaysLabel } from '../settings/availability/working-days';
import React, { useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CheckCircle2, Landmark } from 'lucide-react-native';
import type { StackParamList } from '../../navigation/types';
import {
  useGetDentistQuery,
  useGetPayoutProfileQuery,
  useUpdateDentistMutation,
} from '../../store/dentraApi';
import { useForegroundRefresh } from '../../common/hooks/useForegroundRefresh';
import { useScreenActive } from '../../common/hooks/useScreenActive';
import { useAuth } from '../auth/AuthProvider';
import { useDentist } from '../auth/DentistGate';
import { NotificationBell } from '../notifications/NotificationBell';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/Feedback';
import { colors, layout } from '../../common/theme/theme';
import { formatTime, money } from '../../common/utils/date';
import { errorMessage } from '../../common/utils/api-error';
import {
  SettingsCardHeader,
  SettingsDetail,
  settingsStyles,
} from '../settings/settings-ui';

export function ProfileScreen() {
  const dentist = useDentist();
  const navigation = useNavigation<NativeStackNavigationProp<StackParamList>>();
  const focused = useIsFocused();
  const { signOut } = useAuth();
  const active = useScreenActive();
  const [error, setError] = useState<string | null>(null);
  const { refetch: refreshDentist, isFetching: refreshingDentist } =
    useGetDentistQuery(undefined, { refetchOnMountOrArgChange: false });
  const {
    currentData: payout,
    error: payoutError,
    refetch: refreshPayout,
    isFetching: refreshingPayout,
  } = useGetPayoutProfileQuery(undefined, { skip: !focused });
  const [update, updating] = useUpdateDentistMutation();
  const switchLock = useRef(false);
  useForegroundRefresh(refreshPayout, focused, 15000);

  async function toggleVideo(offersVideo: boolean) {
    if (switchLock.current) return;
    switchLock.current = true;
    setError(null);
    try {
      await update({
        offersVideo,
        ...(offersVideo
          ? {
              videoHoursFrom: dentist.videoHoursFrom?.slice(0, 5) || '10:00',
              videoHoursTo: dentist.videoHoursTo?.slice(0, 5) || '18:30',
            }
          : {}),
      }).unwrap();
    } catch (failure) {
      if (active.current) setError(errorMessage(failure));
    } finally {
      switchLock.current = false;
      updating.reset();
    }
  }
  function logOut() {
    Alert.alert(
      'Log out of Dentra?',
      'You can sign in again with your mobile number.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: () => {
            signOut().catch(failure => {
              if (active.current) setError(errorMessage(failure));
            });
          },
        },
      ],
    );
  }
  const payoutStatus = payout?.request?.status;
  return (
    <Screen action={<NotificationBell />} title="Profile">
      <ScrollView
        contentContainerStyle={settingsStyles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshingDentist || refreshingPayout}
            tintColor={colors.primary}
            onRefresh={() => {
              refreshDentist();
              refreshPayout();
            }}
          />
        }
      >
        <Card style={[settingsStyles.card, styles.identity]}>
          <View style={styles.avatar}>
            <Text style={styles.initials}>
              {dentist.fullName
                .split(' ')
                .filter(Boolean)
                .map(part => part[0])
                .slice(0, 2)
                .join('')}
            </Text>
          </View>
          <View style={styles.grow}>
            <Text style={styles.name}>{dentist.fullName}</Text>
            {!!dentist.specialization && (
              <Text style={settingsStyles.description}>
                {dentist.specialization}
              </Text>
            )}
            <View style={styles.verified}>
              <CheckCircle2 size={13} color={colors.primary} />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          </View>
        </Card>
        <Card style={settingsStyles.card}>
          <SettingsCardHeader
            title="Profile"
            action="Edit"
            onPress={() => navigation.navigate('EditProfile')}
          />
          <SettingsDetail label="Qualification" value={dentist.qualification} />
          <SettingsDetail label="Registration" value={dentist.councilRegNo} />
          <SettingsDetail
            label="Languages"
            value={dentist.languages.join(', ')}
          />
          <SettingsDetail label="Email" value={dentist.email} />
          <SettingsDetail label="Mobile" value={dentist.mobile} />
        </Card>
        <Card style={settingsStyles.card}>
          <SettingsCardHeader
            title={`Locations${
              dentist.clinics.length > 1 ? ` (${dentist.clinics.length})` : ''
            }`}
            action="Manage"
            onPress={() => navigation.navigate('Clinics')}
          />
          {dentist.clinics.length ? (
            dentist.clinics.map((clinic, index) => (
              <View
                key={clinic.id}
                style={[styles.location, index > 0 && styles.locationDivider]}
              >
                <Text style={styles.locationName}>{clinic.name}</Text>
                <Text style={styles.hours}>
                  {workingDaysLabel(clinic.workingDays)} ·{' '}
                  {formatTime(clinic.hoursFrom)}–{formatTime(clinic.hoursTo)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={settingsStyles.description}>No clinics added.</Text>
          )}
        </Card>
        <Card style={settingsStyles.card}>
          <SettingsCardHeader
            title="Fees and hours"
            action="Edit"
            onPress={() => navigation.navigate('ConsultationSettings')}
          />
          <SettingsDetail
            label="Video consult fee"
            value={
              dentist.offersVideo ? money(dentist.feeVideoPaise) : 'Not offered'
            }
          />
          <SettingsDetail
            label="In-clinic fee"
            value={money(dentist.feeClinicPaise)}
          />
          <SettingsDetail
            label="Video hours"
            value={
              dentist.offersVideo &&
              dentist.videoHoursFrom &&
              dentist.videoHoursTo
                ? `${workingDaysLabel(dentist.videoWorkingDays)}, ${formatTime(
                    dentist.videoHoursFrom,
                  )}–${formatTime(dentist.videoHoursTo)}`
                : 'Not offered'
            }
          />
        </Card>
        <Card style={settingsStyles.card}>
          <SettingsCardHeader
            title="Time off"
            action="Manage"
            onPress={() => navigation.navigate('TimeOff')}
          />
          <Text style={settingsStyles.description}>
            Block leave or breaks across all clinics and video consultations.
          </Text>
        </Card>
        <Card style={[settingsStyles.card, layout.between]}>
          <View style={styles.grow}>
            <Text style={styles.toggleTitle}>Offer video consults</Text>
            <Text style={styles.toggleDescription}>
              When off, patients can only book in-clinic visits with you.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Offer video consults"
            value={dentist.offersVideo}
            disabled={updating.isLoading || refreshingDentist}
            trackColor={{ false: colors.line, true: colors.primary }}
            onValueChange={toggleVideo}
          />
        </Card>
        <Card style={settingsStyles.card}>
          <SettingsCardHeader
            title="Payments"
            action="View"
            onPress={() => navigation.navigate('Payments')}
          />
          <Text style={settingsStyles.description}>
            Online payments, clinic collections, outstanding fees and refund
            history.
          </Text>
        </Card>
        <Card style={settingsStyles.card}>
          <SettingsCardHeader
            title="Wallet"
            action="Open"
            onPress={() => navigation.navigate('Wallet')}
          />
          <Text style={settingsStyles.description}>
            Available online earnings, withdrawal requests and history.
          </Text>
        </Card>
        <Card style={settingsStyles.card}>
          <SettingsCardHeader
            title="Payout details"
            action="Manage"
            onPress={() => navigation.navigate('PayoutDetails')}
          />
          <View style={layout.row}>
            <Landmark size={23} color={colors.primary} />
            <View style={styles.grow}>
              <Text style={styles.payoutStatus}>
                {payoutError
                  ? 'Could not load payout status'
                  : !payout
                  ? 'Checking payout details…'
                  : payoutStatus === 'pending'
                  ? 'Awaiting admin approval'
                  : payoutStatus === 'rejected'
                  ? 'Request rejected'
                  : payout.approved
                  ? 'Approved payout account'
                  : 'No payout account added'}
              </Text>
              {payout?.approved?.bankAccountNo && (
                <Text style={settingsStyles.description}>
                  Account ending {payout.approved.bankAccountNo.slice(-4)}
                </Text>
              )}
              {payoutStatus === 'rejected' && (
                <Text style={settingsStyles.description}>
                  Open to review the reason and resubmit.
                </Text>
              )}
            </View>
          </View>
        </Card>
        <ErrorMessage message={error} />
        <Button title="Log out" variant="secondary" onPress={logOut} />
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  grow: { flex: 1, gap: 4 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 20, color: colors.primary, fontWeight: '700' },
  name: { fontSize: 18, color: colors.ink, fontWeight: '700' },
  verified: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  verifiedText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  location: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  locationDivider: {
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingTop: 10,
  },
  locationName: { flex: 1, fontSize: 14, lineHeight: 21, color: colors.ink },
  hours: { fontSize: 12, color: colors.muted, lineHeight: 21 },
  toggleTitle: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  toggleDescription: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  payoutStatus: { fontSize: 14, color: colors.ink, fontWeight: '600' },
});
