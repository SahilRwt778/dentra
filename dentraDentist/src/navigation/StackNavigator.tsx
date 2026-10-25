import { PaymentsScreen } from '../features/payments/PaymentsScreen';
import { WalletScreen } from '../features/wallet/WalletScreen';
import { RequestWithdrawalScreen } from '../features/wallet/RequestWithdrawalScreen';
import { WithdrawalScreen } from '../features/wallet/WithdrawalScreen';
import { PayoutHistoryScreen } from '../features/payments/PayoutHistoryScreen';
import { PayoutBatchScreen } from '../features/payments/PayoutBatchScreen';
import { PaymentReceiptScreen } from '../features/payments/PaymentReceiptScreen';
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../common/theme/theme';
import { AppointmentScreen } from '../features/appointments/AppointmentScreen';
import { RescheduleAppointmentScreen } from '../features/appointments/reschedule/RescheduleAppointmentScreen';
import { NotificationBell } from '../features/notifications/NotificationBell';
import { NotificationsScreen } from '../features/notifications/NotificationsScreen';
import { TabNavigator } from './TabNavigator';
import { EditProfileScreen } from '../features/settings/EditProfileScreen';
import { ClinicsScreen } from '../features/settings/ClinicsScreen';
import { EditClinicScreen } from '../features/settings/EditClinicScreen';
import { TimeOffScreen } from '../features/settings/availability/TimeOffScreen';
import { ConsultationSettingsScreen } from '../features/settings/ConsultationSettingsScreen';
import { PayoutDetailsScreen } from '../features/settings/PayoutDetailsScreen';
import { ConsultationScreen } from '../features/consultation/ConsultationScreen';
import { PatientRecordScreen } from '../features/patients/PatientRecordScreen';
import { PrescriptionPreviewScreen } from '../features/consultation/prescription/PrescriptionPreviewScreen';
import type { StackParamList } from './types';

const Stack = createNativeStackNavigator<StackParamList>();

export function StackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="Home"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Appointment"
        component={AppointmentScreen}
        options={{
          title: 'Appointment',
          headerRight: NotificationBell,
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { fontSize: 20, fontWeight: '600' },
        }}
      />
      <Stack.Screen
        name="RescheduleAppointment"
        component={RescheduleAppointmentScreen}
        options={{ title: 'Reschedule' }}
      />
      <Stack.Screen
        name="PatientRecord"
        component={PatientRecordScreen}
        options={{
          title: 'Patient record',
          headerRight: NotificationBell,
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { fontSize: 20, fontWeight: '600' },
        }}
      />
      <Stack.Screen
        name="Consultation"
        component={ConsultationScreen}
        options={{ title: 'Consultation' }}
      />
      <Stack.Screen
        name="PrescriptionPreview"
        component={PrescriptionPreviewScreen}
        options={{ title: 'Prescription', presentation: 'modal' }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: 'Edit profile' }}
      />
      <Stack.Screen
        name="Clinics"
        component={ClinicsScreen}
        options={{ title: 'Clinic locations' }}
      />
      <Stack.Screen
        name="EditClinic"
        component={EditClinicScreen}
        options={({ route }) => ({
          title: route.params?.clinicId ? 'Edit clinic' : 'Add clinic',
        })}
      />
      <Stack.Screen
        name="TimeOff"
        component={TimeOffScreen}
        options={{ title: 'Time off' }}
      />
      <Stack.Screen
        name="ConsultationSettings"
        component={ConsultationSettingsScreen}
        options={{ title: 'Fees and hours' }}
      />
      <Stack.Screen
        name="PayoutHistory"
        component={PayoutHistoryScreen}
        options={{ title: 'Payout history', headerRight: NotificationBell }}
      />
      <Stack.Screen
        name="PayoutBatch"
        component={PayoutBatchScreen}
        options={{ title: 'Payout details' }}
      />
      <Stack.Screen
        name="Wallet"
        component={WalletScreen}
        options={{ title: 'Wallet', headerRight: NotificationBell }}
      />
      <Stack.Screen
        name="RequestWithdrawal"
        component={RequestWithdrawalScreen}
        options={{ title: 'Request withdrawal' }}
      />
      <Stack.Screen
        name="Withdrawal"
        component={WithdrawalScreen}
        options={{ title: 'Withdrawal request' }}
      />
      <Stack.Screen
        name="Payments"
        component={PaymentsScreen}
        options={{ title: 'Payments', headerRight: NotificationBell }}
      />
      <Stack.Screen
        name="PaymentReceipt"
        component={PaymentReceiptScreen}
        options={{ title: 'Payment details' }}
      />
      <Stack.Screen
        name="PayoutDetails"
        component={PayoutDetailsScreen}
        options={{ title: 'Payout details' }}
      />
    </Stack.Navigator>
  );
}
