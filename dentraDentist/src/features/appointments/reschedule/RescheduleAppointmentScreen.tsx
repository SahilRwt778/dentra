import React from 'react';
import { Text } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { StackParamList } from '../../../navigation/types';
import type { Appointment } from '../../../common/types/api';
import { useGetAppointmentQuery } from '../../../store/dentraApi';
import { useForegroundRefresh } from '../../../common/hooks/useForegroundRefresh';
import { errorMessage } from '../../../common/utils/api-error';
import { formatDate, formatTime } from '../../../common/utils/date';
import { layout } from '../../../common/theme/theme';
import { FormScreen } from '../../../components/ui/FormScreen';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Empty, ErrorMessage, Loading } from '../../../components/ui/Feedback';
import { RescheduleDays } from './RescheduleDays';
import { RescheduleSlots } from './RescheduleSlots';
import { useRescheduleAppointment } from './useRescheduleAppointment';

export function RescheduleAppointmentScreen({
  route,
  navigation,
}: NativeStackScreenProps<StackParamList, 'RescheduleAppointment'>) {
  const focused = useIsFocused();
  const query = useGetAppointmentQuery(route.params.appointmentId);
  useForegroundRefresh(query.refetch, focused, 15000);
  const appointment = query.currentData;
  const error = query.error ? errorMessage(query.error) : null;
  if (
    error &&
    (!appointment ||
      (query.error &&
        'status' in query.error &&
        [403, 404].includes(query.error.status!)))
  )
    return (
      <FormScreen>
        <Empty
          title="Could not load appointment"
          text={error}
          retry={query.refetch}
        />
      </FormScreen>
    );
  if (!appointment)
    return (
      <FormScreen>
        <Loading text="Loading appointment…" />
      </FormScreen>
    );
  return (
    <RescheduleForm
      key={appointment.id}
      appointment={appointment}
      loadError={error}
      reload={query.refetch}
      close={() => navigation.goBack()}
    />
  );
}

function RescheduleForm({
  appointment,
  loadError,
  reload,
  close,
}: {
  appointment: Appointment;
  loadError: string | null;
  reload: () => unknown;
  close: () => void;
}) {
  const form = useRescheduleAppointment(appointment, loadError);
  const disabled = form.busy || !!loadError || form.changed;
  if (form.saved)
    return (
      <FormScreen
        footer={<Button title="Back to appointment" onPress={close} />}
      >
        <Card>
          <Text accessibilityRole="header" style={layout.heading}>
            Appointment rescheduled
          </Text>
          <Text style={layout.body}>
            {formatDate(form.saved.date)} · {formatTime(form.saved.time)}
          </Text>
          <Text style={layout.muted}>
            The patient has been notified of the new time.
          </Text>
        </Card>
      </FormScreen>
    );
  return (
    <FormScreen
      footer={
        form.booked && form.ready ? (
          <Button
            title="Confirm new time"
            disabled={!form.canSave}
            loading={form.busy}
            onPress={form.confirm}
          />
        ) : (
          <Button
            title="Back to appointment"
            variant="secondary"
            onPress={close}
          />
        )
      }
    >
      <Card>
        <Text style={layout.heading}>{appointment.patientName}</Text>
        <Text style={layout.muted}>
          {appointment.type === 'video'
            ? 'Video consultation'
            : appointment.clinicName || 'In-clinic visit'}
        </Text>
        <Text style={layout.label}>Currently</Text>
        <Text style={layout.body}>
          {formatDate(appointment.date)} · {formatTime(appointment.time)}
        </Text>
      </Card>
      {!!loadError && (
        <>
          <ErrorMessage message={loadError} />
          <Button
            title="Refresh appointment"
            variant="secondary"
            disabled={form.busy}
            onPress={reload}
          />
        </>
      )}
      {!form.booked ? (
        <ErrorMessage message="This appointment can no longer be rescheduled." />
      ) : !form.ready ? (
        <>
          <ErrorMessage message="Appointment location could not be loaded. Refresh its details to continue." />
          <Button
            title="Refresh appointment"
            variant="secondary"
            onPress={reload}
          />
        </>
      ) : (
        <>
          {form.changed && (
            <>
              <ErrorMessage message="This appointment was moved on another device. Review its current time before making another change." />
              <Button
                title="Review updated time"
                variant="secondary"
                disabled={form.busy}
                onPress={form.reviewUpdatedTime}
              />
            </>
          )}
          <Card>
            <RescheduleDays
              value={form.date}
              onChange={form.selectDate}
              disabled={disabled}
            />
          </Card>
          <RescheduleSlots form={form} disabled={disabled} />
          <Text style={layout.muted}>
            The patient's original payment carries over. They are notified of
            the new time.
          </Text>
        </>
      )}
      <ErrorMessage message={form.error} />
    </FormScreen>
  );
}
