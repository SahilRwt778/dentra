import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../common/theme/theme';
import { dateKey, formatDate } from '../../common/utils/date';
import { Button } from '../ui/Button';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function CalendarMonth({
  month,
  selected,
  minimumDate,
  onMonth,
  onSelect,
}: {
  month: string;
  selected: string | null;
  minimumDate: string;
  onMonth: (month: string) => void;
  onSelect: (date: string) => void;
}) {
  const first = new Date(`${month}T12:00:00`);
  const year = first.getFullYear();
  const monthIndex = first.getMonth();
  const previous = dateKey(new Date(year, monthIndex - 1, 1, 12));
  const next = dateKey(new Date(year, monthIndex + 1, 1, 12));
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from(
    { length: Math.ceil((first.getDay() + days) / 7) * 7 },
    (_, index) => index - first.getDay() + 1,
  );

  return (
    <View style={styles.calendar}>
      <View style={styles.header}>
        <View style={styles.navigation}>
          <Button
            title="‹"
            accessibilityLabel="Previous month"
            variant="secondary"
            disabled={previous.slice(0, 7) < minimumDate.slice(0, 7)}
            onPress={() => onMonth(previous)}
          />
        </View>
        <Text accessibilityRole="header" style={styles.heading}>
          {first.toLocaleDateString('en-IN', {
            month: 'long',
            year: 'numeric',
          })}
        </Text>
        <View style={styles.navigation}>
          <Button
            title="›"
            accessibilityLabel="Next month"
            variant="secondary"
            onPress={() => onMonth(next)}
          />
        </View>
      </View>
      <View style={styles.grid}>
        {WEEKDAYS.map((label, index) => (
          <View key={`weekday-${index}`} style={styles.cell}>
            <Text style={styles.weekday}>{label}</Text>
          </View>
        ))}
        {cells.map((day, index) => {
          if (day < 1 || day > days)
            return <View key={`blank-${index}`} style={styles.cell} />;
          const date = dateKey(new Date(year, monthIndex, day, 12));
          const disabled = date < minimumDate;
          const chosen = selected === date;
          return (
            <View key={date} style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={formatDate(date)}
                accessibilityState={{ disabled, selected: chosen }}
                disabled={disabled}
                onPress={() => onSelect(date)}
                style={[styles.day, chosen && styles.selected]}
              >
                <Text
                  style={[
                    styles.number,
                    disabled && styles.disabled,
                    chosen && styles.selectedText,
                  ]}
                >
                  {day}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: { gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navigation: { width: 48 },
  heading: {
    flex: 1,
    textAlign: 'center',
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.285714%',
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekday: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  day: {
    width: '100%',
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: { color: colors.ink, fontSize: 16 },
  disabled: { color: colors.line },
  selected: { backgroundColor: colors.primary },
  selectedText: { color: colors.surface, fontWeight: '700' },
});
