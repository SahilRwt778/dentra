import React from 'react';
import { Text, View } from 'react-native';
import { Video } from 'lucide-react-native';
import type { Appointment } from '../../common/types/api';
import { colors } from '../../common/theme/theme';
import { formatTime } from '../../common/utils/date';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/cards/AppointmentCard';
import { useVideoCall } from '../video/VideoCallProvider';
import { PatientProfileLink } from '../patients/PatientProfileLink';
import { consultationStyles as styles } from './consultation.styles';

export function ConsultationPatient({
  appointment,
}: {
  appointment: Appointment;
}) {
  const initials = appointment.patientName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('');
  return (
    <Card style={[styles.card, styles.row]}>
      <View style={styles.avatar}>
        <Text style={styles.initials}>{initials}</Text>
      </View>
      <View style={styles.grow}>
        <Text style={styles.heading}>{appointment.patientName}</Text>
        <Text style={styles.body}>
          {[
            appointment.patientAge != null
              ? `${appointment.patientAge} y`
              : null,
            appointment.patientGender,
            formatTime(appointment.time),
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <PatientProfileLink patientId={appointment.patientId} />
      </View>
      <StatusBadge status={appointment.status} />
    </Card>
  );
}

export function ConsultationVideo({
  appointment,
}: {
  appointment: Appointment;
}) {
  const call = useVideoCall();
  if (appointment.type !== 'video' || appointment.status !== 'in_consult')
    return null;
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Video size={23} color={colors.primary} />
        <View style={styles.grow}>
          <Text style={styles.heading}>Video consultation</Text>
          <Text style={styles.body}>
            Minimize the call with Back to keep writing notes.
          </Text>
        </View>
      </View>
      <Button
        title={
          call.appointmentId === appointment.id
            ? 'Return to video consultation'
            : 'Open video consultation'
        }
        variant="secondary"
        onPress={() =>
          call.open({
            appointmentId: appointment.id,
            patientName: appointment.patientName,
          })
        }
      />
    </Card>
  );
}

export function ReportedConcern({ appointment }: { appointment: Appointment }) {
  return (
    <Card style={styles.card}>
      <Text style={styles.heading}>Reported by patient</Text>
      <Text style={styles.tag}>
        {appointment.concern || 'Concern not provided'}
      </Text>
      <Text style={styles.body}>
        {[
          appointment.symptomArea,
          appointment.symptomSince
            ? `Since ${appointment.symptomSince.toLowerCase()}`
            : null,
          appointment.painScore == null
            ? 'Pain not rated'
            : `Pain ${appointment.painScore}/10`,
          appointment.swelling ? 'Swelling reported' : 'No swelling reported',
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {!!appointment.note && (
        <Text selectable style={styles.body}>
          {appointment.note}
        </Text>
      )}
    </Card>
  );
}
