import React from 'react';
import { Text, View } from 'react-native';
import { appointmentStyles as styles } from './appointment.styles';

export function AppointmentDetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text selectable style={styles.detailValue}>
        {value?.trim() || 'Not provided'}
      </Text>
    </View>
  );
}
