import { Text, View, StyleSheet } from 'react-native';
import { Building2, Video } from 'lucide-react-native';
import type { Appointment } from '@/api/types';
import { Badge, Card } from '@/components/ui';
import {
  formatDate,
  formatTime,
  paymentLabel,
  statusLabel,
} from '@/lib/patient';
import { colors, ui } from '@/theme';

export function AppointmentCard({
  appointment: a,
  onPress,
}: {
  appointment: Appointment;
  onPress: () => void;
}) {
  const date = a.date ? new Date(`${a.date}T12:00:00`) : null;
  const Icon = a.type === 'video' ? Video : Building2;
  return (
    <Card
      onPress={onPress}
      label={`${a.dentistName}, ${formatDate(a.date)}, ${formatTime(a.time)}`}
    >
      <View style={[ui.row, { alignItems: 'flex-start' }]}>
        <View style={s.date}>
          <Text style={s.day}>{date?.getDate() ?? '—'}</Text>
          <Text style={s.month}>
            {date?.toLocaleDateString('en-IN', { month: 'short' })}
          </Text>
        </View>
        <View style={[ui.grow, { gap: 4 }]}>
          <Text style={[ui.body, { fontWeight: '600' }]}>{a.dentistName}</Text>
          <Text style={ui.muted}>
            {formatDate(a.date)} · {formatTime(a.time)}
          </Text>
          <Text style={ui.muted}>{a.concern}</Text>
        </View>
      </View>
      <View style={ui.between}>
        <View style={ui.row}>
          <Icon size={16} color={colors.accent} />
          <Text style={ui.small}>
            {a.type === 'video' ? 'Video consult' : 'In-clinic visit'}
          </Text>
        </View>
        <Badge
          title={statusLabel[a.status ?? ''] ?? 'Appointment'}
          tone={
            a.status === 'cancelled'
              ? 'red'
              : a.status === 'completed'
              ? 'green'
              : 'accent'
          }
        />
      </View>
      {a.payment?.status === 'pending' || a.payment?.status === 'failed' ? (
        <Badge title={paymentLabel[a.payment.status]} tone="amber" />
      ) : null}
    </Card>
  );
}
const s = StyleSheet.create({
  date: {
    width: 52,
    paddingVertical: 7,
    backgroundColor: colors.accentSoft,
    borderRadius: 9,
    alignItems: 'center',
  },
  day: { fontSize: 24, color: colors.accentDeep, fontWeight: '600' },
  month: { fontSize: 12, color: colors.accentDeep },
});
