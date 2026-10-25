import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { ToothStatus } from '../../../common/types/dental-chart';
import { colors } from '../../../common/theme/theme';
import { ToothIcon } from '../../../components/icons/ToothIcon';
import { TOOTH_OPTIONS } from './tooth-options';

export function ToothLegend({
  selected,
  onSelect,
  disabled,
}: {
  selected: ToothStatus;
  onSelect: (status: ToothStatus) => void;
  disabled: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.legend}
    >
      {TOOTH_OPTIONS.map(option => (
        <Pressable
          key={option.value}
          accessibilityRole="button"
          accessibilityLabel={`Mark ${option.label}`}
          accessibilityState={{ selected: selected === option.value, disabled }}
          disabled={disabled}
          onPress={() => {
            if (!disabled) onSelect(option.value);
          }}
          style={[styles.option, selected === option.value && styles.selected]}
        >
          <ToothIcon
            size={18}
            color={option.color}
            fill={option.value === 'missing' ? 'none' : option.background}
            dashed={option.value === 'missing'}
          />
          <Text style={styles.label}>{option.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  legend: { flexDirection: 'row', gap: 8, paddingVertical: 3 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 24,
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  label: { fontSize: 13, color: colors.ink },
});
