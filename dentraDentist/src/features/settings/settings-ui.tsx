import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, layout } from '../../common/theme/theme';
export { FormScreen as SettingsLayout } from '../../components/ui/FormScreen';

export function SettingsCardHeader({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={layout.between}>
      <Text style={settingsStyles.heading}>{title}</Text>
      {action && onPress && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${action} ${title}`}
          onPress={onPress}
          hitSlop={8}
          style={settingsStyles.headerAction}
        >
          <Text style={settingsStyles.link}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function SettingsDetail({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <View style={settingsStyles.detail}>
      <Text style={settingsStyles.detailLabel}>{label}</Text>
      <Text style={settingsStyles.detailValue}>{value || 'Not added'}</Text>
    </View>
  );
}

export const settingsStyles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 28, gap: 14 },
  card: { borderRadius: 14, padding: 16, gap: 12 },
  heading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    flexShrink: 1,
  },
  description: { fontSize: 14, color: colors.muted, lineHeight: 21 },
  footer: {
    padding: 16,
    paddingHorizontal: 18,
    gap: 10,
    borderTopWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  detail: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  detailLabel: {
    width: 116,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 21,
  },
  detailValue: { flex: 1, fontSize: 14, color: colors.ink, lineHeight: 21 },
  headerAction: { minHeight: 36, justifyContent: 'center' },
  link: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12 },
  grow: { flex: 1 },
  note: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
  },
  noteText: { flex: 1, color: colors.ink, fontSize: 13, lineHeight: 20 },
});
