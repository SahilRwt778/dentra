import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { ErrorMessage, Loading } from '../../../components/ui/Feedback';
import { colors, layout } from '../../../common/theme/theme';
import { formatTime } from '../../../common/utils/date';
import type { useRescheduleAppointment } from './useRescheduleAppointment';

export function RescheduleSlots({
  form,
  disabled,
}: {
  form: ReturnType<typeof useRescheduleAppointment>;
  disabled: boolean;
}) {
  return (
    <Card>
      <Text style={layout.heading}>New time</Text>
      {form.slotsError ? (
        <>
          <ErrorMessage message={form.slotsError} />
          <Button
            title="Reload available times"
            variant="secondary"
            loading={form.loadingSlots}
            onPress={form.reloadSlots}
          />
        </>
      ) : form.loadingSlots || !form.slots ? (
        <Loading text="Checking available times…" />
      ) : !form.slots.slots.length ? (
        <Text style={layout.muted}>
          No available times on this date. Choose another day.
        </Text>
      ) : (
        <View style={styles.grid}>
          {form.slots.slots.map(time => (
            <Pressable
              key={time}
              accessibilityRole="button"
              accessibilityLabel={`New time ${formatTime(time)}`}
              accessibilityState={{ selected: form.time === time, disabled }}
              disabled={disabled}
              onPress={() => form.selectTime(time)}
              style={[styles.slot, form.time === time && styles.selected]}
            >
              <Text
                style={form.time === time ? styles.selectedText : layout.label}
              >
                {formatTime(time)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}
const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: {
    width: '30%',
    flexGrow: 1,
    minHeight: 48,
    maxWidth: '48%',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  selected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  selectedText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
});
