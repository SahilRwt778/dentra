import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import type { Appointment } from '../../common/types/api';
import { colors } from '../../common/theme/theme';
import { formatTime } from '../../common/utils/date';
import {
  AppointmentStatusBadge,
  appointmentStatusLabels,
} from './AppointmentStatusBadge';

export function AppointmentRow({
  appointment,
  onPress,
}: {
  appointment: Appointment;
  onPress: () => void;
}) {
  const time = formatTime(appointment.time),
    [clock, period] = time.split(' ');
  const done = appointment.status === 'completed';
  const flagged =
    !done && (appointment.swelling || (appointment.painScore ?? 0) >= 8);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${appointment.patientName}, ${time}, ${
        appointmentStatusLabels[appointment.status]
      }.${
        flagged
          ? appointment.swelling
            ? ' Swelling reported.'
            : ' Severe pain.'
          : ''
      } View appointment.`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.time, done && styles.done]}>
        <Text style={[styles.clock, done && styles.muted]}>{clock}</Text>
        <Text style={[styles.period, done && styles.muted]}>{period}</Text>
      </View>
      <View style={styles.patient}>
        <Text style={styles.name}>{appointment.patientName}</Text>
        <Text numberOfLines={1} style={styles.description}>
          {appointment.type === 'video' ? 'Video' : 'In-clinic'},{' '}
          {appointment.concern || 'Consultation'}
        </Text>
        {flagged && (
          <View style={styles.flag}>
            <AlertTriangle size={13} color={colors.danger} />
            <Text style={styles.flagText}>
              {appointment.swelling ? 'Swelling reported' : 'Severe pain'}
            </Text>
          </View>
        )}
      </View>
      <AppointmentStatusBadge status={appointment.status} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  time: {
    width: 54,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    gap: 1,
  },
  done: { backgroundColor: '#EAF2F2' },
  clock: { fontSize: 15, lineHeight: 18, fontWeight: '600', color: '#0A5F59' },
  period: { fontSize: 11, color: '#0A5F59' },
  muted: { color: colors.muted },
  patient: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '600', color: colors.ink },
  description: { fontSize: 13, lineHeight: 19, color: colors.muted },
  flag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  flagText: { fontSize: 11, color: colors.danger, flexShrink: 1 },
  pressed: { opacity: 0.75 },
});
