import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StackParamList } from '../../navigation/types';
import type { Appointment } from '../../common/types/api';
import { dateKey, formatDate, formatTime } from '../../common/utils/date';
import { errorMessage } from '../../common/utils/api-error';
import { useScreenActive } from '../../common/hooks/useScreenActive';
import { appointmentsApi } from '../../api/appointments.api';
import { useStartConsultationMutation } from '../../store/dentraApi';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/Feedback';
import { appointmentStyles as styles } from '../appointments/appointment.styles';

export function ConsultationAction({
  appointment,
  disabled = false,
}: {
  appointment: Appointment;
  disabled?: boolean;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<StackParamList>>();
  const [start, starting] = useStartConsultationMutation();
  const [error, setError] = useState<string | null>(null);
  const active = useScreenActive();
  const lock = useRef(false);
  if (appointment.status === 'cancelled') return null;
  const needsStart =
    appointment.status === 'booked' || appointment.status === 'waiting';
  const future = needsStart && appointment.date > dateKey();
  function openNotes() {
    navigation.navigate('Consultation', { appointmentId: appointment.id });
  }
  async function open() {
    if (disabled || lock.current || future) return;
    if (!needsStart) {
      openNotes();
      return;
    }
    lock.current = true;
    setError(null);
    try {
      await start(appointment.id).unwrap();
      if (active.current) openNotes();
    } catch (failure) {
      if (!active.current) return;
      // A video call or the web portal may already have started this visit.
      if ((failure as { status?: number }).status === 409) {
        try {
          const current = await appointmentsApi.get(appointment.id);
          if (active.current && current.status === 'in_consult') {
            openNotes();
            return;
          }
        } catch {
          /* Keep the original start error; retry remains available. */
        }
      }
      if (active.current) setError(errorMessage(failure));
    } finally {
      lock.current = false;
      starting.reset();
    }
  }
  return (
    <View style={styles.stack}>
      <ErrorMessage message={error} />
      <Button
        title={
          future
            ? `Starts ${formatDate(appointment.date)}, ${formatTime(
                appointment.time,
              )}`
            : needsStart
            ? 'Start consultation'
            : appointment.status === 'completed'
            ? 'View visit summary'
            : 'Continue consultation'
        }
        loading={starting.isLoading}
        disabled={disabled || future}
        onPress={open}
      />
    </View>
  );
}
