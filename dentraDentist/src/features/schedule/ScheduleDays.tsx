import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import type { Dentist } from '../../common/types/api';
import type { ScheduleDay } from '../../common/types/appointment-actions';
import type { TimeOff } from '../../common/types/availability';
import { colors } from '../../common/theme/theme';
import { addDays, formatDate } from '../../common/utils/date';
import { closedReason, scheduleDayLabel } from './schedule-summary';

type Props = {
  dates: string[];
  today: string;
  selectedDate: string;
  days?: ScheduleDay[];
  dentist: Dentist;
  timeOff?: TimeOff[];
  error: boolean;
  onSelect: (date: string) => void;
  onWeek: (direction: number) => void;
  onToday: () => void;
};

export function ScheduleDays({
  dates,
  today,
  selectedDate,
  days,
  dentist,
  timeOff,
  error,
  onSelect,
  onWeek,
  onToday,
}: Props) {
  const scroll = useRef<ScrollViewInstance>(null);
  const weekStart = dates[0];
  useEffect(() => {
    scroll.current?.scrollTo({ x: 0, animated: false });
  }, [weekStart]);
  return (
    <View>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.days}
      >
        {dates.map(date => {
          const day = days?.find(item => item.date === date);
          const count = day?.appointments.filter(
            item => item.status !== 'cancelled',
          ).length;
          const closed = count === 0 && !!closedReason(date, dentist, timeOff);
          const suffix = error
            ? '—'
            : count === undefined
            ? '…'
            : closed
            ? 'Closed'
            : `(${count})`;
          const selected = date === selectedDate;
          const label = scheduleDayLabel(date, today);
          const spokenDate =
            date === today || date === addDays(today, 1)
              ? `${label}, ${formatDate(date)}`
              : new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });
          return (
            <Pressable
              key={date}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${spokenDate}${
                count === undefined || error
                  ? ''
                  : closed
                  ? ', Closed'
                  : `, ${count} appointments`
              }`}
              onPress={() => onSelect(date)}
              style={[styles.day, selected && styles.selected]}
            >
              <Text style={[styles.dayText, selected && styles.selectedText]}>
                {label} <Text style={styles.count}>{suffix}</Text>
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.navigation}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous week"
          onPress={() => onWeek(-1)}
          style={styles.weekButton}
        >
          <ChevronLeft size={16} color={colors.primary} />
          <Text style={styles.link}>Previous week</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Return to today"
          onPress={onToday}
          style={styles.weekButton}
        >
          <Text style={styles.link}>Today</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next week"
          onPress={() => onWeek(1)}
          style={styles.weekButton}
        >
          <Text style={styles.link}>Next week</Text>
          <ChevronRight size={16} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  days: { gap: 8, paddingHorizontal: 18, paddingTop: 4, paddingBottom: 4 },
  day: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  selected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  dayText: { fontSize: 14, color: colors.ink },
  selectedText: { color: '#0A5F59', fontWeight: '500' },
  count: { fontSize: 12 },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  weekButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
  },
  link: { color: colors.primary, fontSize: 12, fontWeight: '500' },
});
