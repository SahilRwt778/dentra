import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BellRing, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from './NotificationsProvider';
import { colors, layout } from '../../common/theme/theme';
import type { DentistNotification } from '../../common/types/api';
import { notificationContent } from './notification-content';
export function NotificationBanner({
  onOpen,
}: {
  onOpen: (item: DentistNotification) => void;
}) {
  const { notice, dismissNotice } = useNotifications();
  const insets = useSafeAreaInsets();
  if (!notice) return null;
  const content = notificationContent(notice);
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.banner, { top: insets.top + 8 }]}
    >
      <BellRing size={21} color={colors.primary} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={content.accessibilityLabel}
        onPress={() => onOpen(notice)}
        style={styles.content}
      >
        <Text style={layout.label}>{content.title}</Text>
        <Text numberOfLines={1} style={layout.muted}>
          {content.description}
        </Text>
        {!!content.detail && (
          <Text numberOfLines={2} style={layout.muted}>
            {content.detail}
          </Text>
        )}
        <Text style={styles.link}>{content.action}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss notification"
        onPress={dismissNotice}
        style={styles.close}
      >
        <X size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 12,
    right: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    elevation: 8,
    boxShadow: '0px 4px 20px #14304022',
  },
  content: { flex: 1, gap: 5 },
  link: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
