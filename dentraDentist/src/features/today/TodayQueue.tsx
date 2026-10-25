import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { CalendarDays } from 'lucide-react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StackParamList } from '../../navigation/types';
import type { Appointment } from '../../common/types/api';
import { useGetTodayAppointmentsQuery } from '../../store/dentraApi';
import { colors } from '../../common/theme/theme';
import { formatDate } from '../../common/utils/date';
import { errorMessage } from '../../common/utils/api-error';
import { useForegroundRefresh } from '../../common/hooks/useForegroundRefresh';
import { Empty, Loading } from '../../components/ui/Feedback';
import { useBookingUpdates } from '../notifications/NotificationsProvider';
import { todaySummary, dentistGreeting } from './today-summary';
import { TodayOverview } from './TodayOverview';
import { AppointmentRow } from '../../components/cards/AppointmentRow';

export function TodayQueue({
  date,
  dentistName,
  hour,
}: {
  date: string;
  dentistName: string;
  hour: number;
}) {
  const focused = useIsFocused();
  const navigation = useNavigation<NativeStackNavigationProp<StackParamList>>();
  const {
    currentData: appointments,
    error,
    isFetching,
    refetch,
  } = useGetTodayAppointmentsQuery(date, { skip: !focused });
  useForegroundRefresh(refetch, focused);
  useBookingUpdates(refetch, focused);
  const summary = todaySummary(appointments ?? []);
  function openAppointment(appointment: Appointment) {
    if (appointment.status === 'in_consult') {
      navigation.navigate('Consultation', { appointmentId: appointment.id });
    } else {
      navigation.navigate('Appointment', { appointmentId: appointment.id });
    }
  }
  return (
    <FlatList
      data={error ? [] : summary.items}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.content}
      refreshing={isFetching && !!appointments}
      onRefresh={refetch}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.greeting}>
            <Text style={styles.welcome}>
              {dentistGreeting(dentistName, hour)}
            </Text>
            <Text style={styles.date}>Today, {formatDate(date)}</Text>
          </View>
          {error ? (
            <Empty
              title="Could not load today’s appointments"
              text={errorMessage(error)}
              retry={refetch}
            />
          ) : !appointments ? (
            <Loading text="Loading today’s appointments…" />
          ) : (
            <>
              <TodayOverview
                total={summary.items.length}
                waiting={summary.waiting}
                completed={summary.completed}
                next={summary.next}
                onOpen={openAppointment}
                onSchedule={() =>
                  navigation.navigate('Home', { screen: 'Schedule' })
                }
              />
              <View style={styles.section}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  Today's queue
                </Text>
                <Text style={styles.date}>{summary.items.length} booked</Text>
              </View>
            </>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <AppointmentRow
          appointment={item}
          onPress={() =>
            navigation.navigate('Appointment', { appointmentId: item.id })
          }
        />
      )}
      ItemSeparatorComponent={Separator}
      ListEmptyComponent={
        !error && appointments && !isFetching ? (
          <View style={styles.empty}>
            <CalendarDays size={24} color={colors.muted} />
            <Text style={styles.welcome}>No appointments today.</Text>
          </View>
        ) : undefined
      }
      ListFooterComponent={
        !error && summary.flagged ? (
          <Text style={styles.flagNote}>
            Flagged patients reported swelling or pain of 8/10 or more.
          </Text>
        ) : undefined
      }
    />
  );
}
function Separator() {
  return <View style={styles.separator} />;
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 22 },
  header: { gap: 12, marginBottom: 12 },
  greeting: { gap: 2 },
  welcome: { fontSize: 15, lineHeight: 23, color: colors.muted },
  date: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  section: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.ink },
  separator: { height: 12 },
  empty: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  flagNote: {
    marginTop: 12,
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
  },
});
