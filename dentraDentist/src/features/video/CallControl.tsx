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
};
export function CallControl({
  label,
  icon: Icon,
  onPress,
  active = true,
  danger,
  disabled,
  compact,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        compact && styles.compact,
        !active && styles.off,
        danger && styles.danger,
        disabled && styles.disabled,
      ]}
    >
      <Icon size={23} color="#FFFFFF" />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#27636B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { width: 42, height: 42, borderRadius: 21 },
  off: { backgroundColor: '#52616E' },
  danger: { backgroundColor: '#C34F30' },
  disabled: { opacity: 0.45 },
});
