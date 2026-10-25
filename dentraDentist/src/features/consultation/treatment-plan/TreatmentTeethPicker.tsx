import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ToothNumber } from '../../../common/types/dental-chart';
import { colors } from '../../../common/theme/theme';
import {
  UPPER_RIGHT,
  UPPER_LEFT,
  LOWER_RIGHT,
  LOWER_LEFT,
} from '../dental-chart/tooth-options';

export function TreatmentTeethPicker({
  selected,
  disabled,
  onChange,
}: {
  selected: ToothNumber[];
  disabled: boolean;
  onChange: (teeth: ToothNumber[]) => void;
}) {
  function row(label: string, teeth: ToothNumber[]) {
    return (
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.teeth}>
          {teeth.map(tooth => {
            const checked = selected.includes(tooth);
            return (
              <Pressable
                key={tooth}
                accessibilityRole="checkbox"
                accessibilityLabel={`Plan tooth ${tooth}`}
                accessibilityState={{ checked, disabled }}
                disabled={disabled}
                onPress={() =>
                  onChange(
                    checked
                      ? selected.filter(value => value !== tooth)
                      : [...selected, tooth],
                  )
                }
                style={[styles.tooth, checked && styles.selected]}
              >
                <Text style={[styles.number, checked && styles.selectedNumber]}>
                  {tooth}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      accessibilityLabel="Treatment teeth, swipe horizontally to see all teeth"
    >
      <View style={styles.chart}>
        <Text style={styles.label}>Patient’s right → Patient’s left</Text>
        {row('Upper', [...UPPER_RIGHT, ...UPPER_LEFT])}
        {row('Lower', [...LOWER_RIGHT, ...LOWER_LEFT])}
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  chart: { gap: 10, paddingVertical: 4 },
  row: { gap: 6 },
  teeth: { flexDirection: 'row', gap: 5 },
  label: { color: colors.muted, fontSize: 12 },
  tooth: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.primary },
  number: { fontSize: 14, color: colors.ink },
  selectedNumber: { color: colors.surface, fontWeight: '700' },
});
