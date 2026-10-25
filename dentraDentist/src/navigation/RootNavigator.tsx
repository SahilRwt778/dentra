import React from 'react';
import { View } from 'react-native';
import {
  DefaultTheme,
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { colors, layout } from '../common/theme/theme';
import type { DentistNotification } from '../common/types/api';
import { Button } from '../components/ui/Button';
import { Empty, Loading } from '../components/ui/Feedback';
import { FormScreen } from '../components/ui/Screen';
import { LoginScreen } from '../features/Login/LoginScreen';
import { useAuth } from '../features/auth/AuthProvider';
import { DentistGate } from '../features/auth/DentistGate';
import { NotificationBanner } from '../features/notifications/NotificationBanner';
import {
  NotificationsProvider,
  useNotifications,
} from '../features/notifications/NotificationsProvider';
import { VideoCallProvider } from '../features/video/VideoCallProvider';
import { StackNavigator } from './StackNavigator';
import type { StackParamList } from './types';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.ink,
    border: colors.line,
  },
};

export function RootNavigator() {
  const { signedIn, restoring, restoreError, retryRestore, signOut } =
    useAuth();

  if (restoring) {
    return (
      <FormScreen>
        <Loading text="Restoring your session…" />
      </FormScreen>
    );
  }

  if (restoreError) {
    return (
      <FormScreen>
        <Empty
          title="Could not restore your session"
          text={restoreError}
          retry={retryRestore}
        />
        <Button
          title="Sign in with another number"
          variant="secondary"
          onPress={() => {
            signOut().catch(() => {});
          }}
        />
      </FormScreen>
    );
  }

  if (!signedIn) {
    return <LoginScreen />;
  }

  return (
    <DentistGate>
      <NotificationsProvider>
        <AuthenticatedNavigation />
      </NotificationsProvider>
    </DentistGate>
  );
}

// Mounted only after approval, so logout also resets routes and notifications.
function AuthenticatedNavigation() {
  const navigationRef = useNavigationContainerRef<StackParamList>();
  const { dismissNotice, markRead } = useNotifications();

  function openNotification(notification: DentistNotification) {
    if (!navigationRef.isReady()) return;

    dismissNotice();
    markRead(notification);
    if (notification.type === 'wallet_withdrawal_updated') {
      navigationRef.navigate('Withdrawal', {
        withdrawalId: notification.withdrawalId,
      });
    } else {
      navigationRef.navigate('Appointment', {
        appointmentId: notification.appointmentId,
      });
    }
  }

  return (
    <VideoCallProvider>
      <View style={layout.fill}>
        <NavigationContainer ref={navigationRef} theme={navigationTheme}>
          <StackNavigator />
        </NavigationContainer>
        <NotificationBanner onOpen={openNotification} />
      </View>
    </VideoCallProvider>
  );
}
