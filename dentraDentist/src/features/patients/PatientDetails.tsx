import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import type { PatientRecord } from '../../common/types/patient';
import { Card } from '../../components/ui/Card';
import { colors } from '../../common/theme/theme';
import { formatDate } from '../../common/utils/date';
import { PatientAvatar } from './PatientAvatar';
import { patientDemographics } from './patient-format';
import { patientStyles } from './patient-styles';

export function PatientDetails({ patient }: { patient: PatientRecord }) {
  const [phoneError, setPhoneError] = useState<string | null>(null);
  async function openPhone() {
    setPhoneError(null);
    try {
      await Linking.openURL(`tel:${patient.mobile.replace(/[^+0-9]/g, '')}`);
    } catch {
      setPhoneError('Your device could not open the phone app.');
    }
  }
  return (
    <>
      <Card style={patientStyles.card}>
        <View style={styles.identityRow}>
          <PatientAvatar name={patient.fullName} large />
          <View style={styles.identity}>
            <Text accessibilityRole="header" style={patientStyles.heading}>
              {patient.fullName}
            </Text>
            <Text style={patientStyles.muted}>
              {patientDemographics(patient.age, patient.gender)}
            </Text>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Call ${patient.fullName}`}
              onPress={openPhone}
              hitSlop={6}
              style={styles.phoneLink}
            >
              <Text selectable style={styles.phone}>
                {patient.mobile}
              </Text>
            </Pressable>
          </View>
        </View>
        <Detail label="Date of birth" value={formatDate(patient.dateOfBirth)} />
        {phoneError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {phoneError}
          </Text>
        )}
      </Card>
      {patient.guardian && (
        <Card style={patientStyles.card}>
          <Text style={patientStyles.heading}>Guardian</Text>
          <Detail label="Name" value={patient.guardian.name} />
          <Detail label="Relationship" value={patient.guardian.relationship} />
          <Detail label="Mobile" value={patient.guardian.mobile} />
        </Card>
      )}
      <PatientMedicalHistory patient={patient} />
      <Card style={patientStyles.card}>
        <Text style={patientStyles.heading}>Contact</Text>
        <Detail label="City" value={patient.city} />
        <Detail label="Language" value={patient.preferredLanguage} />
        <Detail label="Emergency" value={patient.emergencyContact} />
      </Card>
    </>
  );
}

export function PatientMedicalHistory({
  patient,
}: {
  patient: Pick<
    PatientRecord,
    'allergies' | 'hasAllergies' | 'conditions' | 'medications'
  >;
}) {
  return (
    <Card style={patientStyles.card}>
      <Text accessibilityRole="header" style={patientStyles.heading}>
        Medical history
      </Text>
      <Detail
        label="Allergies"
        value={patient.allergies}
        allergy={patient.hasAllergies}
      />
      <Detail label="Conditions" value={patient.conditions} />
      <Detail label="Medicines" value={patient.medications} />
    </Card>
  );
}

function Detail({
  label,
  value,
  allergy = false,
}: {
  label: string;
  value: string | null;
  allergy?: boolean;
}) {
  return (
    <View style={styles.detail}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.value, allergy && styles.allergy]}>
        {allergy && <AlertTriangle size={13} color={colors.danger} />}
        <Text
          selectable
          style={[
            patientStyles.body,
            styles.valueText,
            allergy && styles.allergyText,
          ]}
        >
          {value?.trim() || 'Not recorded'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  identity: { flex: 1, gap: 3 },
  phoneLink: {
    alignSelf: 'flex-start',
    minHeight: 30,
    justifyContent: 'center',
  },
  phone: { color: colors.primary, fontSize: 13 },
  detail: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  label: { width: '35%', color: colors.muted, fontSize: 13, lineHeight: 21 },
  value: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  valueText: { flexShrink: 1 },
  allergy: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.dangerSoft,
  },
  allergyText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
