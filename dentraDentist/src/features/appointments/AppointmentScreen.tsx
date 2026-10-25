import React from 'react';
import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import type { Appointment } from '../../common/types/api';
import {
  useGetAppointmentQuery,
  useGetPatientRecordQuery,
} from '../../store/dentraApi';
import { useForegroundRefresh } from '../../common/hooks/useForegroundRefresh';
import { errorMessage } from '../../common/utils/api-error';
import { Button } from '../../components/ui/Button';
import { FormScreen } from '../../components/ui/FormScreen';
import { Empty, ErrorMessage, Loading } from '../../components/ui/Feedback';
import { AppointmentAttachments } from '../attachments/AppointmentAttachments';
import { AppointmentVideoCard } from '../video/AppointmentVideoCard';
import { ConsultationAction } from '../consultation/ConsultationAction';
import type { StackParamList } from '../../navigation/types';
import { AppointmentActions } from './AppointmentActions';
import { useAppointmentActions } from './useAppointmentActions';
import { AppointmentOverview } from './AppointmentOverview';
import { AppointmentConcerns } from './AppointmentConcerns';
import { AppointmentPatientHistory } from './AppointmentPatientHistory';
import { AppointmentPaymentDetails } from './payment/AppointmentPaymentDetails';
import { useClinicPayment } from './payment/useClinicPayment';
import { appointmentStyles as styles } from './appointment.styles';

export function AppointmentScreen({
  route,
}: NativeStackScreenProps<StackParamList, 'Appointment'>) {
  const focused = useIsFocused();
  const {
    currentData: appointment,
    error: requestError,
    isFetching: loading,
    refetch: reload,
  } = useGetAppointmentQuery(route.params.appointmentId);
  useForegroundRefresh(reload, focused, 15000);
  const error = requestError ? errorMessage(requestError) : null;
  if (
    error &&
    (!appointment ||
      (requestError &&
        'status' in requestError &&
        [403, 404].includes(requestError.status!)))
  )
    return (
      <Empty title="Could not load appointment" text={error} retry={reload} />
    );
  if (!appointment) return <Loading text="Loading appointment…" />;
  return (
    <AppointmentDetails
      key={appointment.id}
      appointment={appointment}
      loading={loading}
      reload={reload}
      loadError={error}
    />
  );
}

function AppointmentDetails({
  appointment,
  loading,
  reload,
  loadError,
}: {
  appointment: Appointment;
  loading: boolean;
  reload: () => unknown;
  loadError: string | null;
}) {
  const focused = useIsFocused();
  const patientQuery = useGetPatientRecordQuery(appointment.patientId, {
    skip: !focused,
    refetchOnMountOrArgChange: true,
  });
  useForegroundRefresh(patientQuery.refetch, focused);
  const actions = useAppointmentActions(appointment, !!loadError);
  const payment = useClinicPayment(
    appointment,
    !!loadError || !!actions.operation,
  );
  const disabled = !!loadError || !!actions.operation || payment.busy;
  function refresh() {
    reload();
    if (focused) patientQuery.refetch();
  }
  return (
    <FormScreen
      refresh={refresh}
      refreshing={loading || patientQuery.isFetching}
      footer={
        appointment.status !== 'cancelled' ? (
          <ConsultationAction
            key={appointment.id}
            appointment={appointment}
            disabled={disabled}
          />
        ) : undefined
      }
    >
      <ErrorMessage message={loadError} />
      <AppointmentOverview appointment={appointment}>
        <AppointmentPaymentDetails
          appointment={appointment}
          payment={payment}
          disabled={disabled}
        />
      </AppointmentOverview>
      <AppointmentConcerns appointment={appointment} />
      <AppointmentVideoCard appointment={appointment} disabled={disabled} />
      <AppointmentAttachments
        key={`attachments-${appointment.id}`}
        appointmentId={appointment.id}
      />
      <AppointmentPatientHistory
        patient={patientQuery.error ? undefined : patientQuery.currentData}
        appointmentId={appointment.id}
        error={patientQuery.error ? errorMessage(patientQuery.error) : null}
        retry={patientQuery.refetch}
      />
      <AppointmentActions
        appointment={appointment}
        actions={actions}
        disabled={disabled}
      />
      {appointment.status === 'cancelled' && (
        <Text style={styles.muted}>This appointment is cancelled.</Text>
      )}
      <Button
        title="Refresh appointment"
        variant="secondary"
        loading={loading}
        onPress={refresh}
      />
    </FormScreen>
  );
}
