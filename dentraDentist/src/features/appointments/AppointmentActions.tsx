import React from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StackParamList } from '../../navigation/types';
import type { Appointment } from '../../common/types/api';
import { appointmentStyles as styles } from './appointment.styles';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/Feedback';
import { availableAppointmentActions } from './appointment-actions';
import type { useAppointmentActions } from './useAppointmentActions';

export function AppointmentActions({
  appointment,
  actions,
  disabled,
}: {
  appointment: Appointment;
  actions: ReturnType<typeof useAppointmentActions>;
  disabled: boolean;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<StackParamList>>();
  const available = availableAppointmentActions(appointment);
  if (
    !available.checkIn &&
    !available.reschedule &&
    !available.cancel &&
    !actions.error &&
    !actions.notice
  )
    return null;
  return (
    <View style={styles.stack}>
      <ErrorMessage message={actions.error} />
      {!!actions.notice && (
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          {actions.notice}
        </Text>
      )}
      {available.checkIn && (
        <Button
          title="Mark patient as arrived"
          variant="secondary"
          disabled={disabled}
          loading={actions.operation === 'checkIn'}
          onPress={actions.checkIn}
        />
      )}
      {available.reschedule && (
        <Button
          title="Reschedule appointment"
          variant="secondary"
          disabled={disabled}
          onPress={() =>
            navigation.navigate('RescheduleAppointment', {
              appointmentId: appointment.id,
            })
          }
        />
      )}
      {available.cancel && (
        <Button
          title="Cancel appointment"
          variant="danger"
          disabled={disabled}
          loading={actions.operation === 'cancel'}
          onPress={actions.requestCancellation}
        />
      )}
    </View>
  );
}
