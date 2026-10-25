import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Appointment, Dentist } from '../../../common/types/api';
import type { Prescription } from '../../../common/types/prescription';
import { colors } from '../../../common/theme/theme';
import { formatDate, formatTime } from '../../../common/utils/date';
import { Card } from '../../../components/ui/Card';
import { consultationStyles as styles } from '../consultation.styles';

export function PrescriptionSummary({
  appointment,
  prescription,
  dentist,
}: {
  appointment: Appointment;
  prescription: Prescription;
  dentist: Dentist;
}) {
  return (
    <Card style={styles.card}>
      <Text style={styles.heading}>{dentist.fullName}</Text>
      <Text style={styles.body}>
        {dentist.qualification} · Reg. {dentist.councilRegNo}
      </Text>
      <View style={local.divider} />
      <Text style={local.name}>{appointment.patientName}</Text>
      <Text style={styles.body}>
        {[
          appointment.patientAge != null ? `${appointment.patientAge} y` : null,
          appointment.patientGender,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      <Text style={styles.body}>
        {formatDate(appointment.date)} · {formatTime(appointment.time)}
      </Text>
      <Text style={styles.heading}>Prescription</Text>
      {prescription.items.map((item, index) => (
        <View key={index} style={local.medicine}>
          <Text style={local.name}>
            {index + 1}. {item.medicineName} {item.strength}
          </Text>
          <Text style={styles.body}>
            {item.dose} · {item.frequency} · {item.duration}
          </Text>
          {!!item.instructions && (
            <Text style={styles.body}>{item.instructions}</Text>
          )}
        </View>
      ))}
      {!!prescription.signedAt && (
        <>
          <Text style={styles.tag}>Signed prescription</Text>
          <Text style={styles.body}>
            Digitally signed by {dentist.fullName} on{' '}
            {new Date(prescription.signedAt).toLocaleString('en-IN', {
              timeZone: 'Asia/Kolkata',
            })}
            .
          </Text>
        </>
      )}
    </Card>
  );
}
const local = StyleSheet.create({
  divider: { height: 1, backgroundColor: colors.line },
  name: { color: colors.ink, fontSize: 15, fontWeight: '700', lineHeight: 22 },
  medicine: {
    gap: 5,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
});
