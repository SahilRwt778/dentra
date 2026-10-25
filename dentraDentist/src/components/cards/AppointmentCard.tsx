import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AlertTriangle,
  ChevronRight,
  MapPin,
  Video,
} from 'lucide-react-native';
import type { Appointment, AppointmentStatus } from '../../common/types/api';
import { colors, layout } from '../../common/theme/theme';
import { formatTime } from '../../common/utils/date';
export const statusLabels: Record<AppointmentStatus, string> = {
  booked: 'Booked',
  waiting: 'Waiting',
  in_consult: 'In consultation',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <View style={[styles.badge, status === 'cancelled' && styles.cancelled]}>
      <Text
        style={[styles.badgeText, status === 'cancelled' && styles.dangerText]}
      >
        {statusLabels[status] ?? status}
      </Text>
    </View>
  );
}
export function AppointmentCard({
  appointment,
  onPress,
}: {
  appointment: Appointment;
  onPress: () => void;
}) {
  const flagged =
    appointment.status !== 'completed' &&
    appointment.status !== 'cancelled' &&
    (appointment.swelling || (appointment.painScore ?? 0) >= 8);
  const Icon = appointment.type === 'video' ? Video : MapPin;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${appointment.patientName}, ${formatTime(
        appointment.time,
      )}, ${statusLabels[appointment.status]}. View appointment.`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        flagged && styles.flagged,
        pressed && styles.pressed,
      ]}
    >
      <View style={layout.between}>
        <Text style={styles.time}>{formatTime(appointment.time)}</Text>
        <StatusBadge status={appointment.status} />
      </View>
      <View style={layout.between}>
        <View style={styles.patient}>
          <Text style={layout.heading}>{appointment.patientName}</Text>
          <Text style={layout.muted}>
            {[
              appointment.patientAge != null
                ? `${appointment.patientAge} years`
                : null,
              appointment.patientGender,
            ]
              .filter(Boolean)
              .join(' · ') || 'Patient'}
          </Text>
        </View>
        <ChevronRight size={22} color={colors.muted} />
      </View>
      <Text style={layout.body}>
        {appointment.concern || 'Consultation'}
        {appointment.symptomArea ? ` · ${appointment.symptomArea}` : ''}
      </Text>
      <View style={layout.between}>
        <View style={layout.row}>
          <Icon size={17} color={colors.primary} />
          <Text style={layout.muted}>
            {appointment.type === 'video'
              ? 'Video consultation'
              : 'In-clinic visit'}
          </Text>
        </View>
        {appointment.painScore != null && (
          <Text style={layout.muted}>Pain {appointment.painScore}/10</Text>
        )}
      </View>
      {flagged && (
        <View style={layout.row}>
          <AlertTriangle size={16} color={colors.danger} />
          <Text style={styles.dangerText}>
            {appointment.swelling
              ? 'Patient reported swelling'
              : 'Patient reported severe pain'}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 18,
    backgroundColor: colors.surface,
    gap: 13,
  },
  flagged: { borderColor: '#E7B1AC', backgroundColor: '#FFF8F7' },
  pressed: { opacity: 0.75 },
  time: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: colors.primarySoft,
  },
  badgeText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  cancelled: { backgroundColor: colors.dangerSoft },
  dangerText: { color: colors.danger, fontSize: 13 },
  patient: { flex: 1, gap: 4 },
});
