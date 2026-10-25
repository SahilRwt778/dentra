import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors } from '../../common/theme/theme';
export function Card({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, style]} />;
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 18,
    gap: 16,
  },
});
