import React from 'react';
import { Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { consultationDeadline } from '@dentra/call-core';
import type { Appointment } from '../../common/types/api';
import type { StackParamList } from '../../navigation/types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { layout } from '../../common/theme/theme';

export function ConsultationPassCard({
  appointment,
}: {
  appointment: Appointment;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<StackParamList>>();
  const item = appointment.consultationCase;
  if (!item?.activatedAt) return null;
  return (
    <Card>
      <Text style={layout.heading}>
        {appointment.followUpOf ? 'Free follow-up' : '3-day follow-up pass'}
      </Text>
      <Text style={layout.muted}>
        {item.status === 'active'
          ? `Messaging and free follow-ups for the same concern are available until ${consultationDeadline(
              item.expiresAt!,
            )}.`
          : 'Messaging is closed. The conversation history is still available.'}
      </Text>
      <Button
        title={item.status === 'active' ? 'Message patient' : 'View messages'}
        variant="secondary"
        onPress={() => navigation.navigate('Chat', { caseId: item.id })}
      />
      {appointment.followUpOf && (
        <Button
          title="View original consultation"
          variant="secondary"
          onPress={() =>
            navigation.push('Appointment', {
              appointmentId: item.originalAppointmentId,
            })
          }
        />
      )}
    </Card>
  );
}
