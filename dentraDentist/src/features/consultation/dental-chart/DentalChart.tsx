import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
  DentalChartState,
  ToothNumber,
} from '../../../common/types/dental-chart';
import { colors } from '../../../common/theme/theme';
import { ToothIcon } from '../../../components/icons/ToothIcon';
import {
  LOWER_LEFT,
  LOWER_RIGHT,
  toothOption,
  UPPER_LEFT,
  UPPER_RIGHT,
} from './tooth-options';

export function DentalChart({
  form,
  changedTeeth,
  editable,
  onTooth,
}: {
  form: DentalChartState;
  changedTeeth: ToothNumber[];
  editable: boolean;
  onTooth: (tooth: ToothNumber) => void;
}) {
  function quadrant(teeth: ToothNumber[], lower: boolean) {
    return (
      <View style={styles.quadrant}>
        {teeth.map(tooth => {
          const status = form[tooth] ?? 'healthy';
          const option = toothOption(status);
          const changed = changedTeeth.includes(tooth);
          return (
            <Pressable
              key={tooth}
              accessibilityRole="button"
              accessibilityLabel={`Tooth ${tooth}: ${option.label}${
                changed ? ', unsaved' : ''
              }`}
              accessibilityState={{ disabled: !editable }}
              disabled={!editable}
              onPress={() => {
                if (editable) onTooth(tooth);
              }}
              style={[
                styles.tooth,
                lower && styles.lower,
                changed && styles.changed,
              ]}
            >
              <View
                style={[
                  styles.icon,
                  lower && styles.lowerIcon,
                  status === 'missing' && styles.missing,
                ]}
              >
                <ToothIcon
                  size={36}
                  color={option.color}
                  fill={status === 'missing' ? 'none' : option.background}
                  dashed={status === 'missing'}
                />
              </View>
              <Text
                style={[styles.number, status !== 'healthy' && styles.recorded]}
              >
                {tooth}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      accessibilityLabel="Dental chart, swipe horizontally to see all teeth"
      contentContainerStyle={styles.viewport}
    >
      <View style={styles.chart}>
        <View style={styles.labels}>
          <Text style={styles.label}>Patient's right</Text>
          <Text style={styles.label}>Upper</Text>
          <Text style={styles.label}>Patient's left</Text>
        </View>
        <View style={styles.jaw}>
          {quadrant(UPPER_RIGHT, false)}
          {quadrant(UPPER_LEFT, false)}
        </View>
        <View style={styles.jaw}>
          {quadrant(LOWER_RIGHT, true)}
          {quadrant(LOWER_LEFT, true)}
        </View>
        <Text style={[styles.label, styles.lowerLabel]}>Lower</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  viewport: { paddingVertical: 6 },
  chart: { gap: 8 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 12, color: colors.muted },
  lowerLabel: { textAlign: 'center' },
  jaw: { flexDirection: 'row', gap: 16 },
  quadrant: { flexDirection: 'row' },
  tooth: {
    width: 44,
    minHeight: 66,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  lower: { flexDirection: 'column-reverse' },
  changed: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  icon: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lowerIcon: { transform: [{ rotate: '180deg' }] },
  missing: { opacity: 0.6 },
  number: { fontSize: 12, color: colors.muted },
  recorded: { color: colors.ink, fontWeight: '600' },
});
