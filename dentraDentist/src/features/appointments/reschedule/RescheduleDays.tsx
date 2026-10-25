import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DateField } from '../../../components/forms/DateField';
import { addDays, dateKey, formatDate } from '../../../common/utils/date';
import { colors, layout } from '../../../common/theme/theme';

export function RescheduleDays({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (date: string | null) => void;
  disabled: boolean;
}) {
  const today = dateKey();
  return (
    <View style={layout.stack}>
      <DateField
        label="New day"
        value={value}
        onChange={onChange}
        minimumDate={today}
        allowClear={false}
        disabled={disabled}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.days}
      >
        {Array.from({ length: 7 }, (_, index) => addDays(today, index)).map(
          (date, index) => {
            const label =
              index === 0
                ? 'Today'
                : index === 1
                ? 'Tomorrow'
                : new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', {
                    weekday: 'short',
                  });
            return (
              <Pressable
                key={date}
                accessibilityRole="button"
                accessibilityLabel={`${label}, ${formatDate(date)}`}
                accessibilityState={{ selected: value === date, disabled }}
                disabled={disabled}
                onPress={() => onChange(date)}
                style={[styles.day, value === date && styles.selected]}
              >
                <Text
                  style={value === date ? styles.selectedText : layout.muted}
                >
                  {label}
                </Text>
                <Text
                  style={value === date ? styles.selectedText : layout.label}
                >
                  {formatDate(date).replace(/ \d{4}$/, '')}
                </Text>
              </Pressable>
            );
          },
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  days: { gap: 10, paddingVertical: 2 },
  day: {
    minWidth: 82,
    minHeight: 64,
    padding: 12,
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
  },
  selected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  selectedText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
