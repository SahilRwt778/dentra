import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';

export function DismissibleNotice({
  message,
  onDismiss,
  tone = 'error',
}: {
  message: string;
  onDismiss(): void;
  tone?: 'error' | 'warning';
}) {
  return (
    <View style={[styles.notice, tone === 'warning' && styles.warning]}>
      <Text
        accessibilityRole="alert"
        style={[styles.message, tone === 'warning' && styles.warningText]}
      >
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss warning"
        hitSlop={6}
        style={styles.close}
        onPress={onDismiss}
      >
        <X size={20} color={tone === 'warning' ? '#715320' : '#8D2525'} />
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#FDECEC',
  },
  message: { flex: 1, color: '#B52C2C', fontSize: 13, lineHeight: 19 },
  warning: { backgroundColor: '#FFF4DC' },
  warningText: { color: '#715320' },
  close: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
