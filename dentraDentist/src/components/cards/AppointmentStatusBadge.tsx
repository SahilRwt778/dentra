import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { AppointmentStatus } from '../../common/types/api';
import { colors } from '../../common/theme/theme';

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  booked: 'Scheduled',
  waiting: 'Waiting',
  in_consult: 'In consultation',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function AppointmentStatusBadge({
  status,
}: {
  status: AppointmentStatus;
}) {
  return (
    <Text style={[styles.badge, tones[status]]}>
      {appointmentStatusLabels[status]}
    </Text>
  );
}

const tones = StyleSheet.create({
  booked: { color: '#2C65A8', backgroundColor: '#E3EDF8' },
  waiting: { color: colors.amber, backgroundColor: colors.amberSoft },
  in_consult: { color: colors.primary, backgroundColor: colors.primarySoft },
  completed: { color: '#37804C', backgroundColor: '#E3F2E7' },
  cancelled: { color: colors.muted, backgroundColor: colors.background },
});
const styles = StyleSheet.create({
  badge: {
    fontSize: 11,
    fontWeight: '500',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 20,
    overflow: 'hidden',
    maxWidth: 106,
    textAlign: 'center',
  },
});
