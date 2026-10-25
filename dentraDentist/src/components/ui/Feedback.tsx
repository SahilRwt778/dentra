import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { colors, layout } from '../../common/theme/theme';
import { Button } from './Button';
export function ErrorMessage({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View accessibilityRole="alert" style={styles.error}>
      <AlertCircle size={20} color={colors.danger} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}
export function Loading({ text = 'Loading…' }: { text?: string }) {
  return (
    <View accessibilityRole="progressbar" style={styles.center}>
      <ActivityIndicator color={colors.primary} />
      <Text style={layout.muted}>{text}</Text>
    </View>
  );
}
export function Empty({
  title,
  text,
  retry,
}: {
  title: string;
  text?: string;
  retry?: () => void;
}) {
  return (
    <View style={styles.center}>
      <Text style={layout.heading}>{title}</Text>
      {text && <Text style={styles.centerText}>{text}</Text>}
      {retry && (
        <Button title="Try again" variant="secondary" onPress={retry} />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  error: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.dangerSoft,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 14, lineHeight: 21 },
  center: {
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  centerText: { color: colors.muted, textAlign: 'center', lineHeight: 22 },
});
