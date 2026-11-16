import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { colors } from '../../common/theme/theme';

export function ProfileLink({
  title,
  description,
  label,
  icon: Icon,
  onPress,
  divider = false,
  tone,
}: {
  title: string;
  description: string;
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  divider?: boolean;
  tone?: 'warning' | 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={description}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        divider && styles.divider,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.icon}>
        <Icon size={20} color={colors.primary} />
      </View>
      <View style={styles.details}>
        <Text style={styles.title}>{title}</Text>
        <Text
          style={[
            styles.description,
            tone === 'warning' && styles.warning,
            tone === 'danger' && styles.danger,
          ]}
        >
          {description}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: { flex: 1, gap: 3 },
  title: { color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  description: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  divider: { borderTopWidth: 1, borderColor: colors.line },
  pressed: { backgroundColor: colors.primarySoft },
  warning: { color: colors.amber },
  danger: { color: colors.danger },
});
