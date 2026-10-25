import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StackParamList } from '../../navigation/types';
import type { PatientRecord } from '../../common/types/patient';
import { colors } from '../../common/theme/theme';
import { formatDate } from '../../common/utils/date';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/Feedback';
import { PatientMedicalHistory } from '../patients/PatientDetails';
import { appointmentStyles as styles } from './appointment.styles';

export function AppointmentPatientHistory({
  patient,
  appointmentId,
  error,
  retry,
}: {
  patient?: PatientRecord;
  appointmentId: string;
  error: string | null;
  retry: () => void;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<StackParamList>>();
  if (error)
    return (
      <Card style={styles.card}>
        <Text style={styles.heading}>Patient history</Text>
        <ErrorMessage message={error} />
        <Button
          title="Retry patient history"
          variant="secondary"
          onPress={retry}
        />
      </Card>
    );
  if (!patient)
    return (
      <Card style={styles.card}>
        <Text style={styles.muted}>Loading patient history…</Text>
      </Card>
    );
  const visits = patient.appointments.filter(
    visit => visit.status === 'completed' && visit.id !== appointmentId,
  );
  return (
    <>
      <PatientMedicalHistory patient={patient} />
      <Card style={styles.card}>
        <Text accessibilityRole="header" style={styles.heading}>
          Past visits with you
        </Text>
        {visits.length ? (
          visits.map(visit => (
            <Pressable
              key={visit.id}
              accessibilityRole="button"
              accessibilityLabel={`View visit from ${formatDate(visit.date)}`}
              onPress={() =>
                navigation.navigate('Consultation', { appointmentId: visit.id })
              }
              style={local.visit}
            >
              <View style={styles.grow}>
                <Text style={styles.label}>{formatDate(visit.date)}</Text>
                <Text style={styles.muted}>
                  {visit.diagnosis || visit.concern || 'Consultation'}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.muted} />
            </Pressable>
          ))
        ) : (
          <Text style={styles.muted}>No other completed visits with you.</Text>
        )}
      </Card>
    </>
  );
}

const local = StyleSheet.create({
  visit: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: colors.line,
  },
});
