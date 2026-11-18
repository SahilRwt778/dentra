import { StyleSheet, Text, View } from 'react-native';
import {
  Building2,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Clock3,
  Video,
} from 'lucide-react-native';
import type { Appointment } from '@/api/types';
import { Badge, Card } from '@/components/ui';
import { DentistAvatar } from './dentist-avatar';
import {
  formatDate,
  formatTime,
  paymentLabel,
  statusLabel,
} from '@/lib/patient';
import { colors, ui } from '@/theme';

export function AppointmentCard({
  appointment,
  onPress,
}: {
  appointment: Appointment;
  onPress: () => void;
}) {
  const VisitIcon = appointment.type === 'video' ? Video : Building2;
  const visitType =
    appointment.type === 'video' ? 'Video consultation' : 'In-clinic visit';
  const dentistName = appointment.dentistName || 'Dentist';
  const date = formatDate(appointment.date);
  const time = formatTime(appointment.time);
  const status = statusLabel[appointment.status ?? ''] ?? 'Appointment';
  const paymentStatus = appointment.payment?.status;
  const paymentNeedsAttention =
    paymentStatus === 'pending' || paymentStatus === 'failed';

  return (
    <Card
      onPress={onPress}
      label={`${dentistName}, ${visitType}, ${date}, ${time}, ${status}`}
      style={s.card}
    >
      <View style={s.header}>
        <DentistAvatar
          dentistId={appointment.dentistId}
          name={dentistName}
          photoUrl={appointment.dentistPhotoUrl}
        />
        <View style={[ui.grow, s.identity]}>
          <Text style={s.name} numberOfLines={2}>
            {dentistName}
          </Text>
          <View style={s.visitType}>
            <VisitIcon size={14} color={colors.accent} />
            <Text style={s.visitLabel}>{visitType}</Text>
          </View>
        </View>
        <ChevronRight size={20} color={colors.muted} />
      </View>

      <View style={s.schedule}>
        <View style={s.scheduleItem}>
          <CalendarDays size={16} color={colors.accent} />
          <Text style={s.scheduleText}>{date}</Text>
        </View>
        <View style={s.scheduleItem}>
          <Clock3 size={16} color={colors.accent} />
          <Text style={s.scheduleText}>{time}</Text>
        </View>
      </View>

      <View style={s.footer}>
        {appointment.concern ? (
          <Text style={s.concern} numberOfLines={2}>
            {appointment.concern}
          </Text>
        ) : null}
        <Badge
          title={status}
          tone={
            appointment.status === 'cancelled'
              ? 'red'
              : appointment.status === 'completed'
              ? 'green'
              : 'accent'
          }
        />
      </View>

      {paymentNeedsAttention ? (
        <View
          style={[
            s.paymentNotice,
            paymentStatus === 'failed' && s.paymentFailed,
          ]}
        >
          <CircleAlert
            size={15}
            color={paymentStatus === 'failed' ? colors.red : colors.amber}
          />
          <Text
            style={[
              s.paymentText,
              paymentStatus === 'failed' && s.paymentFailedText,
            ]}
          >
            {paymentLabel[paymentStatus]}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}
const s = StyleSheet.create({
  card: { borderRadius: 16, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  identity: { gap: 4 },
  name: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  visitType: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  visitLabel: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    flexShrink: 1,
  },
  schedule: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 16,
    rowGap: 8,
    backgroundColor: colors.soft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    maxWidth: '100%',
  },
  scheduleText: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    flexShrink: 1,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'space-between',
  },
  concern: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 130,
  },
  paymentNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.amberSoft,
  },
  paymentText: {
    color: colors.amber,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    flex: 1,
  },
  paymentFailed: { backgroundColor: colors.redSoft },
  paymentFailedText: { color: colors.red },
});
