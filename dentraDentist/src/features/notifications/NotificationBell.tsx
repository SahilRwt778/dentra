import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StackParamList } from '../../navigation/types';
import { useNotifications } from './NotificationsProvider';
import { colors } from '../../common/theme/theme';
export function NotificationBell() {
  const navigation = useNavigation<NativeStackNavigationProp<StackParamList>>();
  const { data, error } = useNotifications();
  const unread = data?.unreadCount ?? 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        error
          ? 'Notifications, unable to refresh'
          : `Notifications, ${unread} unread`
      }
      onPress={() => navigation.navigate('Notifications')}
      style={styles.button}
    >
      <Bell size={23} color={colors.primary} />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.count}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
      {!!error && unread === 0 && <View style={styles.offline} />}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -4,
    minWidth: 21,
    minHeight: 21,
    paddingHorizontal: 4,
    borderRadius: 11,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { fontSize: 11, fontWeight: '700', color: colors.surface },
  offline: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.amber,
  },
});
