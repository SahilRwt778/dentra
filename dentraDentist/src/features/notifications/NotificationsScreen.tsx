import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Bell, ChevronRight } from 'lucide-react-native';
import { useGetNotificationsQuery } from '../../store/dentraApi';
import { errorMessage } from '../../common/utils/api-error';
import { colors, layout } from '../../common/theme/theme';
import type { DentistNotification } from '../../common/types/api';
import type { StackParamList } from '../../navigation/types';
import { Button } from '../../components/ui/Button';
import { Empty, ErrorMessage, Loading } from '../../components/ui/Feedback';
import { useNotifications } from './NotificationsProvider';
import { notificationContent } from './notification-content';

export function NotificationsScreen({
  navigation,
}: NativeStackScreenProps<StackParamList, 'Notifications'>) {
  const inbox = useNotifications();
  const reloadInbox = inbox.reload;
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursors[cursors.length - 1];
  const focused = useIsFocused();
  const active = useRef(true);
  const currentCursor = useRef(cursor);
  currentCursor.current = cursor;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const result = useGetNotificationsQuery(cursor, {
    skip: !cursor || !focused,
  });
  const older = {
    data: result.currentData,
    error: result.error ? errorMessage(result.error) : null,
    loading: result.isFetching,
    reload: result.refetch,
  };
  const { data, error, loading, reload } = cursor ? older : inbox;
  useEffect(() => {
    if (focused && !cursor) reloadInbox();
  }, [focused, cursor, reloadInbox]);
  const items = data?.items ?? [];
  function open(item: DentistNotification) {
    inbox.dismissNotice();
    // Open the destination even if marking read temporarily fails.
    inbox.markRead(item);
    if (item.type === 'wallet_withdrawal_updated') {
      navigation.navigate('Withdrawal', { withdrawalId: item.withdrawalId });
    } else {
      navigation.navigate('Appointment', { appointmentId: item.appointmentId });
    }
  }
  async function readAll() {
    const through = inbox.data?.items[0]?.id;
    if (
      through &&
      (await inbox.markAllRead(through)) &&
      cursor &&
      active.current &&
      currentCursor.current === cursor
    )
      older.reload();
  }
  return (
    <FlatList
      data={items}
      keyExtractor={item => item.id}
      contentContainerStyle={layout.content}
      refreshing={loading && !!data}
      onRefresh={reload}
      ListHeaderComponent={
        <View style={layout.stack}>
          <View style={layout.between}>
            <View style={layout.stack}>
              <Text style={layout.heading}>Your updates</Text>
              <Text style={layout.muted}>
                {inbox.data
                  ? `${inbox.data.unreadCount} unread`
                  : 'Appointment and withdrawal notifications'}
              </Text>
            </View>
            <Bell size={26} color={colors.primary} />
          </View>
          <ErrorMessage message={error || inbox.actionError} />
          {error && (
            <Button
              title="Try again"
              variant="secondary"
              loading={loading}
              onPress={reload}
            />
          )}
          <Button
            title="Mark all as read"
            variant="secondary"
            loading={inbox.marking}
            disabled={!inbox.data?.unreadCount || !inbox.data.items.length}
            onPress={readAll}
          />
        </View>
      }
      renderItem={({ item }) => {
        const content = notificationContent(item);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.readAt ? '' : 'Unread. '}${
              content.accessibilityLabel
            }`}
            onPress={() => open(item)}
            style={[styles.item, !item.readAt && styles.unread]}
          >
            <View style={layout.between}>
              <Text style={layout.label}>{content.title}</Text>
              {!item.readAt && <View style={styles.dot} />}
            </View>
            <Text style={layout.body}>{content.description}</Text>
            {!!content.detail && (
              <Text style={layout.muted}>{content.detail}</Text>
            )}
            <View style={layout.between}>
              <Text style={styles.created}>
                {new Date(item.createdAt).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
              <View style={layout.row}>
                <Text style={styles.link}>{content.action}</Text>
                <ChevronRight size={16} color={colors.primary} />
              </View>
            </View>
          </Pressable>
        );
      }}
      ItemSeparatorComponent={Separator}
      ListEmptyComponent={
        loading ? (
          <Loading text="Loading notifications…" />
        ) : !error ? (
          <Empty
            title="No updates yet"
            text="You’ll see appointment bookings and withdrawal updates here."
          />
        ) : undefined
      }
      ListFooterComponent={
        cursors.length > 1 || data?.nextCursor ? (
          <View style={styles.pagination}>
            <Text style={layout.muted}>Page {cursors.length}</Text>
            <View style={layout.row}>
              <Button
                title="Newer"
                variant="secondary"
                disabled={loading || inbox.marking || cursors.length === 1}
                onPress={() => setCursors(current => current.slice(0, -1))}
              />
              <Button
                title="Older"
                variant="secondary"
                disabled={
                  loading || inbox.marking || !data?.nextCursor || !!error
                }
                onPress={() =>
                  setCursors(current => [...current, data!.nextCursor!])
                }
              />
            </View>
          </View>
        ) : undefined
      }
    />
  );
}
function Separator() {
  return <View style={styles.separator} />;
}
const styles = StyleSheet.create({
  item: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    gap: 10,
  },
  unread: { borderColor: '#A6D2CC', backgroundColor: '#F0FAF7' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  created: { color: colors.muted, fontSize: 12, flex: 1 },
  link: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  separator: { height: 12 },
  pagination: { paddingTop: 20, alignItems: 'center', gap: 12 },
});
