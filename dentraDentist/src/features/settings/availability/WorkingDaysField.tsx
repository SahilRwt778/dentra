import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, layout } from '../../../common/theme/theme';
import { WEEKDAYS } from './working-days';

export function WorkingDaysField({
  value,
  onChange,
  disabled = false,
}: {
  value: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={layout.label}>Working days</Text>
      <View style={styles.days}>
        {WEEKDAYS.map(day => {
          const selected = value.includes(day.value);
          return (
            <Pressable
              key={day.value}
              accessibilityRole="checkbox"
              accessibilityLabel={day.name}
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              style={[styles.day, selected && styles.selected]}
              onPress={() =>
                onChange(
                  selected
                    ? value.filter(item => item !== day.value)
                    : [...value, day.value].sort(),
                )
              }
            >
              <Text style={[styles.text, selected && styles.selectedText]}>
                {day.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={layout.muted}>
        Choose no days to pause new bookings. Existing appointments keep their
        time.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  field: { gap: 10 },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  day: {
    minWidth: 52,
    minHeight: 48,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  text: { fontSize: 14, color: colors.ink },
  selectedText: { color: colors.primary, fontWeight: '700' },
});
