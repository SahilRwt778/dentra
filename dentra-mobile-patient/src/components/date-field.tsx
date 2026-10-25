import { useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { CalendarDays } from 'lucide-react-native';
import { Button } from '@/components/ui';
import { dateIso, formatDate } from '@/lib/patient';
import { colors, ui } from '@/theme';

export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  initialDate = new Date(),
  placeholder = 'Select a date',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  initialDate?: Date;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(initialDate);

  function showPicker() {
    if (open) return;
    Keyboard.dismiss();
    const parsed = value ? new Date(`${value}T12:00:00`) : initialDate;
    const date = Number.isNaN(parsed.getTime()) ? initialDate : parsed;
    const selected = new Date(
      Math.min(
        maximumDate?.getTime() ?? Infinity,
        Math.max(minimumDate?.getTime() ?? -Infinity, date.getTime()),
      ),
    );
    setDraft(selected);
    setOpen(true);

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        mode: 'date',
        display: 'default',
        value: selected,
        minimumDate,
        maximumDate,
        positiveButton: { label: 'Select', textColor: colors.accent },
        negativeButton: { label: 'Cancel', textColor: colors.muted },
        onValueChange: (_event, picked) => {
          setOpen(false);
          onChange(dateIso(picked));
        },
        onDismiss: () => setOpen(false),
      });
    }
  }

  return (
    <View>
      <Text style={ui.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Opens the date picker"
        accessibilityValue={{ text: value ? formatDate(value) : placeholder }}
        onPress={showPicker}
        style={s.field}
      >
        <Text style={[ui.body, ui.grow, !value && s.placeholder]}>
          {value ? formatDate(value) : placeholder}
        </Text>
        <CalendarDays size={20} color={colors.accent} />
      </Pressable>
      {Platform.OS === 'ios' ? (
        <Modal
          visible={open}
          transparent
          animationType="slide"
          onRequestClose={() => setOpen(false)}
        >
          <View style={s.overlay}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel date selection"
              onPress={() => setOpen(false)}
              style={ui.grow}
            />
            <SafeAreaView edges={['bottom']} style={s.sheet}>
              <Text accessibilityRole="header" style={ui.heading}>
                {label}
              </Text>
              <DateTimePicker
                value={draft}
                mode="date"
                display="spinner"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onValueChange={(_event, date) => setDraft(date)}
                themeVariant="light"
                textColor={colors.ink}
              />
              <View style={ui.row}>
                <View style={ui.grow}>
                  <Button
                    title="Cancel"
                    variant="secondary"
                    onPress={() => setOpen(false)}
                  />
                </View>
                <View style={ui.grow}>
                  <Button
                    title="Select date"
                    onPress={() => {
                      setOpen(false);
                      onChange(dateIso(draft));
                    }}
                  />
                </View>
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  field: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  placeholder: { color: colors.muted },
  overlay: { flex: 1, backgroundColor: '#00000066' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    gap: 12,
  },
});
