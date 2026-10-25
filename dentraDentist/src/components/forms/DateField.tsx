import React, { useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays } from 'lucide-react-native';
import { colors, layout } from '../../common/theme/theme';
import { dateKey, formatDate } from '../../common/utils/date';
import { Button } from '../ui/Button';
import { CalendarMonth } from './CalendarMonth';

/** Dates stay as local calendar strings; opening/cancelling never changes the form. */
export function DateField({
  label,
  value,
  onChange,
  disabled = false,
  minimumDate = dateKey(),
  allowClear = true,
  clearLabel = 'Clear follow-up date',
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  minimumDate?: string;
  allowClear?: boolean;
  clearLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [month, setMonth] = useState(`${minimumDate.slice(0, 7)}-01`);
  function show() {
    if (disabled) return;
    Keyboard.dismiss();
    const fallback = dateKey() >= minimumDate ? dateKey() : minimumDate;
    const initial = value && value >= minimumDate ? value : fallback;
    setSelected(initial);
    setMonth(`${initial.slice(0, 7)}-01`);
    setOpen(true);
  }
  return (
    <View style={styles.field}>
      <Text style={layout.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Opens the calendar"
        accessibilityValue={{
          text: value ? formatDate(value) : 'No date selected',
        }}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={show}
        style={styles.input}
      >
        <Text style={value ? layout.body : layout.muted}>
          {value ? formatDate(value) : 'Select a date (optional)'}
        </Text>
        <CalendarDays size={19} color={colors.primary} />
      </Pressable>
      {!!value && !disabled && allowClear && (
        <Button
          title={clearLabel}
          variant="secondary"
          onPress={() => onChange(null)}
        />
      )}
      <Modal
        visible={open && !disabled}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss date picker"
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />
          {open && (
            <SafeAreaView
              edges={['left', 'right', 'bottom']}
              style={styles.sheet}
              accessibilityViewIsModal
            >
              <ScrollView contentContainerStyle={styles.content}>
                <Text accessibilityRole="header" style={layout.heading}>
                  {label}
                </Text>
                <CalendarMonth
                  month={month}
                  selected={selected}
                  minimumDate={minimumDate}
                  onMonth={setMonth}
                  onSelect={setSelected}
                />
                <View style={styles.actions}>
                  <View style={styles.grow}>
                    <Button
                      title="Cancel"
                      variant="secondary"
                      onPress={() => setOpen(false)}
                    />
                  </View>
                  <View style={styles.grow}>
                    <Button
                      title="Select date"
                      disabled={!selected || selected < minimumDate}
                      onPress={() => {
                        if (disabled || !selected || selected < minimumDate)
                          return;
                        onChange(selected);
                        setOpen(false);
                      }}
                    />
                  </View>
                </View>
              </ScrollView>
            </SafeAreaView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    backgroundColor: colors.surface,
    gap: 8,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#10283A66',
  },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  content: { padding: 18, gap: 16 },
  actions: { flexDirection: 'row', gap: 12 },
  grow: { flex: 1 },
});
