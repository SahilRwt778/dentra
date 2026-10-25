import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock3 } from 'lucide-react-native';
import { colors, layout } from '../../common/theme/theme';
import { formatTime } from '../../common/utils/date';
import { Button } from '../ui/Button';

const HOURS = Array.from({ length: 24 }, (_, value) =>
  String(value).padStart(2, '0'),
);
const MINUTES = Array.from({ length: 60 }, (_, value) =>
  String(value).padStart(2, '0'),
);

export function TimeField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState('10');
  const [minute, setMinute] = useState('00');
  function show() {
    const [h, m] = value.split(':');
    setHour(h);
    setMinute(m);
    setOpen(true);
  }
  return (
    <View style={styles.field}>
      <Text style={layout.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatTime(value)}`}
        disabled={disabled}
        onPress={show}
        style={[styles.input, disabled && styles.disabled]}
      >
        <Text style={layout.body}>{formatTime(value)}</Text>
        <Clock3 size={19} color={colors.primary} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss time picker"
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />
          {open && (
            <SafeAreaView
              edges={['bottom', 'left', 'right']}
              style={styles.sheet}
              accessibilityViewIsModal
            >
              <Text style={layout.heading}>{label}</Text>
              <Text style={layout.muted}>Choose a time (24-hour format).</Text>
              <View style={styles.columns}>
                {[
                  {
                    title: 'Hour',
                    values: HOURS,
                    selected: hour,
                    select: setHour,
                  },
                  {
                    title: 'Minute',
                    values: MINUTES,
                    selected: minute,
                    select: setMinute,
                  },
                ].map(column => (
                  <View key={column.title} style={styles.column}>
                    <Text style={styles.columnTitle}>{column.title}</Text>
                    <ScrollView
                      style={styles.options}
                      contentOffset={{
                        x: 0,
                        y: Math.max(0, Number(column.selected) - 2) * 44,
                      }}
                    >
                      {column.values.map(option => (
                        <Pressable
                          key={option}
                          accessibilityRole="button"
                          accessibilityLabel={`${column.title} ${option}`}
                          accessibilityState={{
                            selected: column.selected === option,
                          }}
                          onPress={() => column.select(option)}
                          style={[
                            styles.option,
                            option === column.selected && styles.selected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.optionText,
                              option === column.selected && styles.selectedText,
                            ]}
                          >
                            {option}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ))}
              </View>
              <View style={styles.columns}>
                <View style={styles.column}>
                  <Button
                    title="Cancel"
                    variant="secondary"
                    onPress={() => setOpen(false)}
                  />
                </View>
                <View style={styles.column}>
                  <Button
                    title="Set time"
                    onPress={() => {
                      onChange(`${hour}:${minute}`);
                      setOpen(false);
                    }}
                  />
                </View>
              </View>
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
  disabled: { opacity: 0.55 },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#10283A66',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    gap: 16,
  },
  columns: { flexDirection: 'row', gap: 14 },
  column: { flex: 1 },
  columnTitle: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  options: { height: 220 },
  option: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  selected: { backgroundColor: colors.primarySoft },
  optionText: { fontSize: 17, color: colors.ink },
  selectedText: { color: colors.primary, fontWeight: '700' },
});
