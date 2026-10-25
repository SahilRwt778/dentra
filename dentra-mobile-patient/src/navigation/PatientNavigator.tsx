import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CalendarDays,
  FolderHeart,
  House,
  UserRound,
} from 'lucide-react-native';
import { HomeScreen } from '@/screens/HomeScreen';
import { AppointmentsScreen } from '@/screens/AppointmentsScreen';
import { RecordsScreen, VisitScreen } from '@/screens/RecordsScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { DentistsScreen, DentistScreen } from '@/screens/DentistsScreen';
import { BookingScreen } from '@/screens/BookingScreen';
import {
  AppointmentScreen,
  RescheduleScreen,
} from '@/screens/AppointmentScreen';
import { HelpScreen } from '@/screens/SupportScreen';
import { NotificationsScreen } from '@/screens/NotificationsScreen';
import { VideoCallProvider } from '@/video/video-call-provider';
import { PatientPushProvider } from '@/notifications/push-provider';
import { useNotificationSync } from '@/hooks/use-notification-sync';
import type { PatientScreenProps, PatientStackParams, TabName } from './types';
import { colors } from '@/theme';

const Stack = createNativeStackNavigator<PatientStackParams>();
const tabs = [
  { name: 'Home', icon: House },
  { name: 'Appointments', icon: CalendarDays },
  { name: 'Records', icon: FolderHeart },
  { name: 'Profile', icon: UserRound },
] as const;
function MainScreen({ route, navigation }: PatientScreenProps<'Main'>) {
  const [tab, setTab] = useState<TabName>(route.params?.tab ?? 'Home');
  const [prescriptions, setPrescriptions] = useState(
    !!route.params?.prescriptions,
  );
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (route.params?.tab) {
      setTab(route.params.tab);
      setPrescriptions(!!route.params.prescriptions);
      navigation.setParams({ tab: undefined, prescriptions: undefined });
    }
  }, [route.params, navigation]);
  return (
    <View style={s.root}>
      <View style={s.content}>
        {tab === 'Home' ? (
          <HomeScreen />
        ) : tab === 'Appointments' ? (
          <AppointmentsScreen />
        ) : tab === 'Records' ? (
          <RecordsScreen
            key={String(prescriptions)}
            prescriptions={prescriptions}
          />
        ) : (
          <ProfileScreen />
        )}
      </View>
      <View
        accessibilityRole="tablist"
        style={[s.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}
      >
        {tabs.map(({ name, icon: Icon }) => (
          <Pressable
            key={name}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === name }}
            onPress={() => {
              setTab(name);
              setPrescriptions(false);
            }}
            style={s.tab}
          >
            <Icon
              size={23}
              color={tab === name ? colors.accent : colors.muted}
              strokeWidth={tab === name ? 2.3 : 1.8}
            />
            <Text style={[s.label, tab === name && s.selected]}>{name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function PatientNavigator() {
  useNotificationSync();
  return (
    <PatientPushProvider>
      <VideoCallProvider>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="Main" component={MainScreen} />
          <Stack.Screen name="Dentists" component={DentistsScreen} />
          <Stack.Screen name="Dentist" component={DentistScreen} />
          <Stack.Screen
            name="Booking"
            component={BookingScreen}
            options={{ gestureEnabled: false }}
          />
          <Stack.Screen name="Appointment" component={AppointmentScreen} />
          <Stack.Screen name="Reschedule" component={RescheduleScreen} />
          <Stack.Screen name="Visit" component={VisitScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="Help" component={HelpScreen} />
        </Stack.Navigator>
      </VideoCallProvider>
    </PatientPushProvider>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { flex: 1 },
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingTop: 10,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    minHeight: 48,
  },
  label: { fontSize: 10.5, color: colors.muted },
  selected: { color: colors.accent, fontWeight: '600' },
});
