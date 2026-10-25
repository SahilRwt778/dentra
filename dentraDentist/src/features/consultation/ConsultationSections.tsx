import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../common/theme/theme';

export type ConsultationSection = 'note' | 'chart' | 'rx' | 'plan';
export function ConsultationSections({
  selected,
  onSelect,
  noteDirty,
  chartDirty,
  rxDirty,
  planDirty,
  medicineCount,
  disabled,
}: {
  selected: ConsultationSection;
  onSelect: (section: ConsultationSection) => void;
  noteDirty: boolean;
  chartDirty: boolean;
  rxDirty: boolean;
  planDirty: boolean;
  medicineCount: number;
  disabled: boolean;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.tabs}>
      {(
        [
          { key: 'note', label: 'Note', dirty: noteDirty },
          { key: 'chart', label: 'Chart', dirty: chartDirty },
          { key: 'rx', label: 'Rx', dirty: rxDirty },
          { key: 'plan', label: 'Plan', dirty: planDirty },
        ] as const
      ).map(section => (
        <Pressable
          key={section.key}
          accessibilityRole="tab"
          accessibilityLabel={section.label}
          accessibilityState={{ selected: selected === section.key, disabled }}
          accessibilityHint={
            section.dirty ? 'Contains unsaved changes' : undefined
          }
          disabled={disabled}
          onPress={() => {
            if (!disabled) onSelect(section.key);
          }}
          style={[styles.tab, selected === section.key && styles.selected]}
        >
          <Text
            style={[
              styles.label,
              selected === section.key && styles.selectedLabel,
            ]}
          >
            {section.label}
            {section.key === 'rx' && medicineCount > 0
              ? ` (${medicineCount})`
              : ''}
            {section.dirty ? ' •' : ''}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#E7EFEE',
    padding: 3,
    borderRadius: 25,
    gap: 3,
  },
  tab: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 22,
  },
  selected: { backgroundColor: colors.surface },
  label: { fontSize: 14, color: colors.muted },
  selectedLabel: { fontWeight: '600', color: colors.ink },
});
