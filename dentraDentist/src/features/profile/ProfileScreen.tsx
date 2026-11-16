import React, { useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StackParamList } from '../../navigation/types';
import {
  useGetDentistQuery,
  useGetPayoutProfileQuery,
  useUpdateDentistMutation,
} from '../../store/dentraApi';
import { useForegroundRefresh } from '../../common/hooks/useForegroundRefresh';
import { useScreenActive } from '../../common/hooks/useScreenActive';
import { colors, layout } from '../../common/theme/theme';
import { errorMessage } from '../../common/utils/api-error';
import { Screen } from '../../components/ui/Screen';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/Feedback';
import { useAuth } from '../auth/AuthProvider';
import { useDentist } from '../auth/DentistGate';
import { NotificationBell } from '../notifications/NotificationBell';
import { ProfileIdentityCard } from './ProfileIdentityCard';
import { ProfileDetailsCard } from './ProfileDetailsCard';
import { ProfilePracticeCards } from './ProfilePracticeCards';
import { ProfilePaymentLinks } from './ProfilePaymentLinks';

export function ProfileScreen() {
  const dentist = useDentist();
  const navigation = useNavigation<NativeStackNavigationProp<StackParamList>>();
  const focused = useIsFocused();
  const { signOut } = useAuth();
  const active = useScreenActive();
  const [videoError, setVideoError] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
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
    setVideoError(null);
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
      if (active.current) setVideoError(errorMessage(failure));
    } finally {
      switchLock.current = false;
      updating.reset();
    }
  }
  function logOut() {
    setLogoutError(null);
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
              if (active.current) setLogoutError(errorMessage(failure));
            });
          },
        },
      ],
    );
  }
  return (
    <Screen action={<NotificationBell />} title="Profile" compactHeader>
      <ScrollView
        style={layout.grow}
        contentContainerStyle={styles.content}
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
        <ProfileIdentityCard
          dentist={dentist}
          onEdit={() => navigation.navigate('EditProfile')}
        />
        <ProfileDetailsCard dentist={dentist} />
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Your practice
        </Text>
        <ProfilePracticeCards
          dentist={dentist}
          updating={updating.isLoading || refreshingDentist}
          onClinics={() => navigation.navigate('Clinics')}
          onFees={() => navigation.navigate('ConsultationSettings')}
          onTimeOff={() => navigation.navigate('TimeOff')}
          onToggleVideo={toggleVideo}
        />
        <ErrorMessage message={videoError} />
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Payments and payouts
        </Text>
        <ProfilePaymentLinks
          payout={payout}
          payoutError={!!payoutError}
          onPayments={() => navigation.navigate('Payments')}
          onWallet={() => navigation.navigate('Wallet')}
          onPayoutDetails={() => navigation.navigate('PayoutDetails')}
        />
        <ErrorMessage message={logoutError} />
        <Button title="Log out" variant="danger" onPress={logOut} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 28, gap: 14 },
  sectionTitle: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
});
