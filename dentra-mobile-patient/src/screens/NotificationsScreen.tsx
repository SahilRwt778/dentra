import { PushPreferences } from '@/notifications/push-preferences';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Bell,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  Clock3,
  XCircle,
} from 'lucide-react-native';
import { useNotifications } from '@/hooks/use-notifications';
import type { PatientAppointmentNotification } from '@/api/types';
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorState,
  Loading,
  Screen,
} from '@/components/ui';
import { notificationMessage, notificationTitle } from '@/lib/notifications';
import { formatDate, formatTime } from '@/lib/patient';
import type { PatientScreenProps } from '@/navigation/types';
import { colors, ui } from '@/theme';

export function NotificationsScreen({
  navigation,
}: PatientScreenProps<'Notifications'>) {
  const {
    items,
    unread,
    error,
    isLoading,
    isFetching,
    nextCursor,
    loadingOlder,
    olderError,
    markingAll,
    readError,
    markNotificationRead,
    markAllRead: readAll,
    loadOlder: older,
    refresh,
  } = useNotifications();

  function open(item: PatientAppointmentNotification) {
    if (!item.readAt) {
      markNotificationRead(item.id).catch(() =>
        Alert.alert(
          'Could not mark this update as read',
          'The appointment is still available. You can try again from Notifications.',
        ),
      );
    }
    navigation.navigate(
      item.type === 'visit_summary_ready' ? 'Visit' : 'Appointment',
      { appointmentId: item.appointmentId },
    );
  }

  return (
    <Screen
      title="Notifications"
      onBack={navigation.goBack}
      refreshing={isFetching}
      onRefresh={refresh}
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mark all notifications as read"
          accessibilityState={{
            disabled: !unread || markingAll || loadingOlder,
          }}
          disabled={!unread || markingAll || loadingOlder}
          onPress={readAll}
          style={[
            s.markAll,
            (!unread || markingAll || loadingOlder) && s.disabled,
          ]}
        >
          <CheckCheck size={22} color={colors.accent} />
        </Pressable>
      }
    >
      <PushPreferences />
      <Text style={ui.muted}>{unread} unread · Your appointment updates</Text>
      {readError && (
        <ErrorState
          message="Could not mark notifications read. Please try again."
          retry={readAll}
        />
      )}
      {error ? (
        <ErrorState retry={refresh} />
      ) : isLoading ? (
        <Loading />
      ) : items.length ? (
        items.map(item => {
          const Icon =
            item.type === 'appointment_cancelled'
              ? XCircle
              : item.type === 'appointment_reminder'
              ? Clock3
              : item.type === 'visit_summary_ready'
              ? CheckCircle2
              : CalendarDays;
          return (
            <Card
              key={item.id}
              onPress={() => open(item)}
              label={`${notificationTitle(item)}, ${
                item.dentistName
              }, ${formatDate(item.date)} at ${formatTime(item.time)}${
                item.readAt ? '' : ', unread'
              }`}
              style={!item.readAt ? s.unread : undefined}
            >
              <View style={[ui.row, s.alignStart]}>
                <Icon
                  color={
                    item.type === 'appointment_cancelled'
                      ? colors.red
                      : colors.accent
                  }
                  size={23}
                />
                <View style={[ui.grow, s.copy]}>
                  <View style={s.titleRow}>
                    <Text style={[ui.heading, s.title]}>
                      {notificationTitle(item)}
                    </Text>
                    {!item.readAt && <Badge title="Unread" />}
                  </View>
                  <Text style={ui.body}>{item.dentistName}</Text>
                  <Text style={ui.muted}>{notificationMessage(item)}</Text>
                  <Text style={ui.body}>
                    {formatDate(item.date)} · {formatTime(item.time)} IST
                  </Text>
                  {item.previousDate && item.previousTime && (
                    <Text style={ui.small}>
                      Previously {formatDate(item.previousDate)} ·{' '}
                      {formatTime(item.previousTime)} IST
                    </Text>
                  )}
                  <Text style={ui.small}>
                    {new Date(item.createdAt).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                  <Text style={s.link}>
                    {item.type === 'visit_summary_ready'
                      ? 'View visit summary'
                      : 'View appointment'}{' '}
                    →
                  </Text>
                </View>
              </View>
            </Card>
          );
        })
      ) : (
        <Empty
          title="You’re all caught up"
          message="Booking updates and appointment reminders will appear here."
          icon={Bell}
        />
      )}
      {olderError && (
        <ErrorState message="Could not load older updates." retry={older} />
      )}
      {!error && nextCursor && (
        <Button
          title="Load older updates"
          variant="secondary"
          loading={loadingOlder}
          disabled={markingAll}
          onPress={older}
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  markAll: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  disabled: { opacity: 0.4 },
  unread: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  alignStart: { alignItems: 'flex-start' },
  copy: { gap: 8 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: { flexGrow: 1, flexShrink: 1 },
  link: { color: colors.accentDeep, fontSize: 13, fontWeight: '600' },
});
