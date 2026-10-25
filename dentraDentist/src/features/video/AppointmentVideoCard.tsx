import React from 'react';
import { Text, View } from 'react-native';
import { Video } from 'lucide-react-native';
import type { Appointment } from '../../common/types/api';
import { colors } from '../../common/theme/theme';
import { appointmentStyles as styles } from '../appointments/appointment.styles';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useVideoCall } from './VideoCallProvider';

export function AppointmentVideoCard({
  appointment,
  disabled = false,
}: {
  appointment: Appointment;
  disabled?: boolean;
}) {
  const call = useVideoCall();
  if (appointment.type !== 'video') return null;
  const closed =
    appointment.status === 'completed' || appointment.status === 'cancelled';
  const current = call.appointmentId === appointment.id;
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Video size={20} color={colors.primary} />
        <Text style={styles.heading}>Video consultation</Text>
      </View>
      <Text style={styles.muted}>
        {closed
          ? 'This appointment has ended.'
          : 'Join from 10 minutes before the appointment. Payment must be confirmed before joining.'}
      </Text>
      {!closed && (
        <Button
          disabled={disabled}
          title={
            current ? 'Return to video consultation' : 'Open video consultation'
          }
          onPress={() => {
            if (disabled) return;
            call.open({
              appointmentId: appointment.id,
              patientName: appointment.patientName,
            });
          }}
        />
      )}
    </Card>
  );
}
