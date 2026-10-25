import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { CalendarDays } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StackParamList } from '../../navigation/types';
import { colors } from '../../common/theme/theme';
import { errorMessage } from '../../common/utils/api-error';
import { Screen } from '../../components/ui/Screen';
import { Empty, ErrorMessage, Loading } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/Button';
import { AppointmentRow } from '../../components/cards/AppointmentRow';
import { useDentist } from '../auth/DentistGate';
import { NotificationBell } from '../notifications/NotificationBell';
import { ScheduleDays } from './ScheduleDays';
import {
  closedReason,
  scheduledAppointments,
  scheduleDayLabel,
} from './schedule-summary';
import { useSchedule } from './useSchedule';

export function ScheduleScreen() {
  const dentist = useDentist();
  const navigation = useNavigation<NativeStackNavigationProp<StackParamList>>();
  const schedule = useSchedule();
  const { result, timeOff, selectedDate, today } = schedule;
  const days = result.currentData;
  const selectedDay = days?.find(day => day.date === selectedDate);
  const items = scheduledAppointments(selectedDay?.appointments ?? []);
  const cancelled =
    selectedDay?.appointments.filter(item => item.status === 'cancelled')
      .length ?? 0;
  const closed = closedReason(
    selectedDate,
    dentist,
    timeOff.error ? [] : timeOff.currentData,
  );
  const dayLabel = scheduleDayLabel(selectedDate, today);
  const emptyMessage =
    dayLabel === 'Today' || dayLabel === 'Tomorrow'
      ? `No appointments ${dayLabel.toLowerCase()}.`
      : `No appointments on ${dayLabel}.`;

  return (
    <Screen title="Schedule" compactHeader action={<NotificationBell />}>
      <ScheduleDays
        dates={schedule.dates}
        today={today}
        selectedDate={selectedDate}
        days={days}
        dentist={dentist}
        timeOff={timeOff.error ? undefined : timeOff.currentData}
        error={!!result.error}
        onSelect={schedule.selectDate}
        onWeek={schedule.changeWeek}
        onToday={schedule.resetToday}
      />
      <FlatList
        data={result.error ? [] : items}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.content}
        refreshing={result.isFetching && !!days}
        onRefresh={schedule.refresh}
        ListHeaderComponent={
          timeOff.error ? (
            <View style={styles.warning}>
              <ErrorMessage message="Time-off information could not be loaded." />
              <Button
                title="Retry time off"
                variant="secondary"
                onPress={timeOff.refetch}
              />
            </View>
          ) : undefined
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
          result.error ? (
            <Empty
              title="Could not load schedule"
              text={errorMessage(result.error)}
              retry={schedule.refresh}
            />
          ) : !selectedDay ? (
            <Loading text="Loading schedule…" />
          ) : (
            <View style={styles.empty}>
              <CalendarDays size={24} color={colors.muted} />
              <Text style={styles.emptyText}>{closed ?? emptyMessage}</Text>
            </View>
          )
        }
        ListFooterComponent={
          !result.error && cancelled > 0 ? (
            <Text style={styles.cancelled}>
              {cancelled} cancelled appointment{cancelled === 1 ? '' : 's'}{' '}
              hidden.
            </Text>
          ) : undefined
        }
      />
    </Screen>
  );
}
function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 22 },
  separator: { height: 12 },
  empty: {
    padding: 24,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  cancelled: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  warning: { gap: 8, marginBottom: 12 },
});
