import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Mic } from 'lucide-react-native';

type Props = {
  label: string;
  icon: typeof Mic;
  onPress: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  compact?: boolean;
  busy?: boolean;
  selected?: boolean;
};
export function CallControl({
  label,
  icon: Icon,
  onPress,
  active = true,
  danger,
  disabled,
  compact,
  busy = false,
  selected,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled || busy, busy, selected }}
      disabled={disabled || busy}
      onPress={onPress}
      style={[
        styles.button,
        compact && styles.compact,
        !active && styles.off,
        danger && styles.danger,
        selected && styles.selected,
        disabled && styles.disabled,
      ]}
    >
      <Icon size={23} color="#FFFFFF" />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#27636B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { width: 42, height: 42, borderRadius: 21 },
  off: { backgroundColor: '#52616E' },
  danger: { backgroundColor: '#C34F30' },
  selected: {
    backgroundColor: '#0D7870',
    borderWidth: 1,
    borderColor: '#85D6CF',
  },
  disabled: { opacity: 0.45 },
});
