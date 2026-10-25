import React from 'react';
import { Text } from 'react-native';
import type { TimeOffPreview } from '../../../common/types/availability';
import { formatDate, formatTime } from '../../../common/utils/date';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { settingsStyles } from '../settings-ui';

export function TimeOffReview({
  preview,
  disabled,
  onOpen,
}: {
  preview: TimeOffPreview;
  disabled: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <Card style={settingsStyles.card}>
      <Text style={settingsStyles.heading}>
        {preview.total
          ? `${preview.total} appointments need attention`
          : 'Ready to block this period'}
      </Text>
      <Text style={settingsStyles.description}>
        {preview.total
          ? 'Move or cancel these appointments first, then check again. Time off has not been saved.'
          : 'No active appointments overlap this period. Confirm to close these times at all clinics and for video consultations.'}
      </Text>
      {preview.appointments.map(appointment => (
        <Button
          key={appointment.id}
          variant="secondary"
          disabled={disabled}
          title={`${appointment.patientName} · ${formatDate(
            appointment.date,
          )}, ${formatTime(appointment.time)} · ${
            appointment.type === 'video'
              ? 'Video'
              : appointment.clinicName ?? 'Clinic'
          }`}
          onPress={() => onOpen(appointment.id)}
        />
      ))}
      {preview.total > preview.appointments.length && (
        <Text style={settingsStyles.description}>
          Showing the first {preview.appointments.length} appointments. Check
          again after resolving them to see the remaining appointments.
        </Text>
      )}
    </Card>
  );
}
