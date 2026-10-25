import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, ChevronRight } from 'lucide-react-native';
import type { PatientSummary } from '../../common/types/patient';
import { colors } from '../../common/theme/theme';
import { formatDate } from '../../common/utils/date';
import { PatientAvatar } from './PatientAvatar';
import { patientDemographics } from './patient-format';

export function PatientCard({
  patient,
  onPress,
}: {
  patient: PatientSummary;
  onPress: () => void;
}) {
  const demographics = patientDemographics(patient.age, patient.gender);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${patient.fullName}, ${patient.mobile}. View patient record.`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <PatientAvatar name={patient.fullName} />
      <View style={styles.details}>
        <Text style={styles.name}>{patient.fullName}</Text>
        <Text numberOfLines={1} style={styles.meta}>
          {demographics}
          {demographics ? '. ' : ''}
          {patient.lastVisitDate
            ? `Last visit ${formatDate(patient.lastVisitDate)}`
            : 'No visits yet'}
        </Text>
        {patient.hasAllergies && (
          <View style={styles.flag}>
            <AlertTriangle size={13} color={colors.danger} />
            <Text style={styles.allergy}>Allergy on file</Text>
          </View>
        )}
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 16,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  details: { flex: 1, gap: 3 },
  name: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  flag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  allergy: { color: colors.danger, fontSize: 11 },
  pressed: { opacity: 0.75 },
});
