import React from 'react';
import { Text, View } from 'react-native';
import type { Appointment } from '../../common/types/api';
import {
  addDays,
  dateKey,
  formatDate,
  formatTime,
} from '../../common/utils/date';
import { Card } from '../../components/ui/Card';
import { AppointmentStatusBadge } from '../../components/cards/AppointmentStatusBadge';
import { PatientAvatar } from '../patients/PatientAvatar';
import { patientDemographics } from '../patients/patient-format';
import { PatientProfileLink } from '../patients/PatientProfileLink';
import { AppointmentDetailRow } from './AppointmentDetailRow';
import { appointmentStyles as styles } from './appointment.styles';

export function AppointmentOverview({
  appointment,
  children,
}: {
  appointment: Appointment;
  children: React.ReactNode;
}) {
  const today = dateKey();
  const day =
    appointment.date === today
      ? 'Today'
      : appointment.date === addDays(today, 1)
      ? 'Tomorrow'
      : formatDate(appointment.date);
  return (
    <>
      <Card style={[styles.card, styles.row]}>
        <PatientAvatar name={appointment.patientName} large />
        <View style={styles.grow}>
          <Text accessibilityRole="header" style={styles.heading}>
            {appointment.patientName}
          </Text>
          <Text style={styles.muted}>
            {patientDemographics(
              appointment.patientAge,
              appointment.patientGender,
            )}
          </Text>
        </View>
        <PatientProfileLink patientId={appointment.patientId} compact />
      </Card>
      <Card style={styles.card}>
        <View style={styles.between}>
          <Text style={[styles.heading, styles.grow]}>
            {day}, {formatTime(appointment.time)}
          </Text>
          <AppointmentStatusBadge status={appointment.status} />
        </View>
        <AppointmentDetailRow
          label="Visit"
          value={
            appointment.type === 'video'
              ? 'Video consultation'
              : 'In-clinic visit'
          }
        />
        {appointment.type === 'clinic' && (
          <AppointmentDetailRow label="Clinic" value={appointment.clinicName} />
        )}
        {children}
      </Card>
    </>
  );
}
