import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PatientAppointment } from '../../common/types/patient';
import { colors } from '../../common/theme/theme';
import { formatDate, formatTime } from '../../common/utils/date';
import {
  AppointmentStatusBadge,
  appointmentStatusLabels,
} from '../../components/cards/AppointmentStatusBadge';

export function PatientVisitCard({
  visit,
  onPress,
}: {
  visit: PatientAppointment;
  onPress: () => void;
}) {
  const when = [
    formatDate(visit.date),
    visit.time ? formatTime(visit.time) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const action =
    visit.status === 'completed' ? 'View visit summary' : 'View appointment';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${when}, ${
        appointmentStatusLabels[visit.status]
      }. ${action}.`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.details}>
        <Text style={styles.date}>{when}</Text>
        <Text style={styles.meta}>
          {visit.type === 'video' ? 'Video consult' : 'In-clinic visit'}.{' '}
          {visit.concern || 'Consultation'}
        </Text>
        {!!visit.clinicName && visit.type === 'clinic' && (
          <Text style={styles.meta}>{visit.clinicName}</Text>
        )}
        {!!visit.diagnosis && (
          <Text style={styles.meta}>Diagnosis: {visit.diagnosis}</Text>
        )}
      </View>
      <AppointmentStatusBadge status={visit.status} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  details: { flex: 1, gap: 4 },
  date: { color: colors.ink, fontSize: 14, fontWeight: '600', lineHeight: 21 },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.75 },
});
