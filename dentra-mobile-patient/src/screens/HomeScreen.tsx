import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Bell,
  CalendarDays,
  FolderHeart,
  LifeBuoy,
  Search,
} from 'lucide-react-native';
import { Tooth } from '@/components/tooth-icon';
import { useNotificationsQuery } from '@/api/notifications';
import { usePatientQuery } from '@/api/patients';
import { AppointmentCard } from '@/components/appointment-card';
import {
  Button,
  Empty,
  ErrorState,
  Loading,
  Screen,
  Section,
  TextLink,
} from '@/components/ui';
import { useAppointments } from '@/hooks/use-appointments';
import { activeAppointment, appointmentOrder } from '@/lib/patient';
import type { PatientNavigation } from '@/navigation/types';
import { colors, ui } from '@/theme';

export function HomeScreen() {
  const nav = useNavigation<PatientNavigation>();
  const { data: me } = usePatientQuery();
  const { data: notifications } = useNotificationsQuery();
  const unread = notifications?.unreadCount ?? 0;
  const { items, isLoading, isFetching, error, refetch } = useAppointments();
  const upcoming = items.filter(activeAppointment).sort(appointmentOrder);
  const visits = items
    .filter(a => a.status === 'completed')
    .sort(appointmentOrder);
  const last = visits[visits.length - 1];
  const quick = [
    {
      title: 'Find a dentist',
      icon: Search,
      press: () => nav.navigate('Dentists'),
    },
    {
      title: 'Prescriptions',
      icon: FolderHeart,
      press: () =>
        nav.navigate('Main', { tab: 'Records', prescriptions: true }),
    },
    {
      title: 'Help and support',
      icon: LifeBuoy,
      press: () => nav.navigate('Help'),
    },
  ];
  return (
    <Screen
      tabbed
      title="Dentra"
      refreshing={isFetching}
      onRefresh={refetch}
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Notifications, ${unread} unread`}
          onPress={() => nav.navigate('Notifications')}
          style={s.bell}
        >
          <Bell size={21} color={colors.ink} />
          {unread > 0 && (
            <View style={s.notificationBadge}>
              <Text style={s.notificationCount}>
                {unread > 99 ? '99+' : unread}
              </Text>
            </View>
          )}
        </Pressable>
      }
    >
      <Text style={ui.muted}>
        Hello, {me?.fullName?.split(' ')[0] ?? 'there'}
      </Text>
      <View style={s.hero}>
        <Tooth size={140} color="#FFFFFF20" style={s.watermark} />
        <Text style={s.heroTitle}>
          Tooth trouble?{'\n'}See a dentist today.
        </Text>
        <Text style={s.heroText}>
          Video consults and clinic visits with verified dentists.
        </Text>
        <View style={s.heroButton}>
          <Button
            title="Book a visit"
            variant="white"
            onPress={() => nav.navigate('Booking')}
          />
        </View>
      </View>
      <View style={s.quick}>
        {quick.map(({ title, icon: Icon, press }) => (
          <Pressable
            key={title}
            accessibilityRole="button"
            onPress={press}
            style={s.quickItem}
          >
            <Icon size={24} color={colors.accent} />
            <Text style={s.quickText}>{title}</Text>
          </Pressable>
        ))}
      </View>
      <Section
        title="Next appointment"
        action={
          <TextLink
            title="See all"
            onPress={() => nav.navigate('Main', { tab: 'Appointments' })}
          />
        }
      >
        {error ? (
          <ErrorState retry={refetch} />
        ) : isLoading ? (
          <Loading />
        ) : upcoming[0] ? (
          <AppointmentCard
            appointment={upcoming[0]}
            onPress={() =>
              nav.navigate('Appointment', { appointmentId: upcoming[0].id! })
            }
          />
        ) : (
          <Empty
            icon={CalendarDays}
            title="A little room in your calendar"
            message="No upcoming appointments. Book a visit whenever you need us."
          />
        )}
      </Section>
      {last ? (
        <Section title="Your latest visit">
          <AppointmentCard
            appointment={last}
            onPress={() => nav.navigate('Visit', { appointmentId: last.id! })}
          />
        </Section>
      ) : null}
    </Screen>
  );
}
const s = StyleSheet.create({
  bell: {
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -7,
    minWidth: 20,
    borderRadius: 12,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: colors.red,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  notificationCount: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  hero: {
    backgroundColor: colors.accent,
    borderRadius: 20,
    padding: 22,
    gap: 10,
    overflow: 'hidden',
  },
  heroTitle: {
    fontSize: 25,
    lineHeight: 32,
    fontWeight: '600',
    color: 'white',
    letterSpacing: -0.6,
  },
  heroText: { fontSize: 14, lineHeight: 22, color: '#FFFFFFDB', maxWidth: 250 },
  heroButton: { alignSelf: 'flex-start', marginTop: 8 },
  watermark: {
    position: 'absolute',
    bottom: -28,
    right: -24,
    transform: [{ rotate: '12deg' }],
  },
  quick: { flexDirection: 'row', gap: 8 },
  quickItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 17,
    gap: 9,
    minHeight: 100,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
  },
  quickText: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    fontWeight: '500',
  },
});
