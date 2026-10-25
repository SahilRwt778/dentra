import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import type { Appointment } from '../../common/types/api';
import { colors } from '../../common/theme/theme';
import { Card } from '../../components/ui/Card';
import { AppointmentDetailRow } from './AppointmentDetailRow';
import { appointmentStyles as styles } from './appointment.styles';

export function AppointmentConcerns({
  appointment,
}: {
  appointment: Appointment;
}) {
  const active =
    appointment.status !== 'completed' && appointment.status !== 'cancelled';
  const highPain = appointment.painScore != null && appointment.painScore >= 8;
  const concerns = [
    ...new Set(
      appointment.concern
        .split(',')
        .map(value => value.trim())
        .filter(Boolean),
    ),
  ];
  return (
    <>
      {active && (appointment.swelling || highPain) && (
        <View accessibilityRole="alert" style={local.warning}>
          <AlertTriangle size={20} color={colors.danger} />
          <Text style={local.warningText}>
            Patient reported{' '}
            {[
              appointment.swelling ? 'swelling' : null,
              highPain ? `pain of ${appointment.painScore}/10` : null,
            ]
              .filter(Boolean)
              .join(' and ')}
            .
          </Text>
        </View>
      )}
      <Card style={styles.card}>
        <Text accessibilityRole="header" style={styles.heading}>
          Patient concerns
        </Text>
        <View style={local.tags}>
          {(concerns.length ? concerns : ['Concern not provided']).map(
            concern => (
              <Text key={concern} style={local.tag}>
                {concern}
              </Text>
            ),
          )}
        </View>
        <AppointmentDetailRow label="Where" value={appointment.symptomArea} />
        <AppointmentDetailRow label="Since" value={appointment.symptomSince} />
        <AppointmentDetailRow
          label="Pain"
          value={
            appointment.painScore == null
              ? 'Not rated'
              : `${appointment.painScore}/10`
          }
        />
        <AppointmentDetailRow
          label="Swelling"
          value={appointment.swelling ? 'Yes' : 'No'}
        />
        {!!appointment.note && (
          <AppointmentDetailRow label="Note" value={appointment.note} />
        )}
      </Card>
    </>
  );
}

const local = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tag: {
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    overflow: 'hidden',
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 12,
    lineHeight: 18,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    padding: 14,
    backgroundColor: colors.dangerSoft,
  },
  warningText: { flex: 1, color: colors.danger, fontSize: 13, lineHeight: 20 },
});
