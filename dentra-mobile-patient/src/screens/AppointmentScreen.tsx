import { ClinicPaymentDetails } from '@/components/clinic-payment-details';
import { cancellationPaymentMessage } from '@/lib/clinic-payment';
import { useEffect, useState } from 'react';
import { Alert, Linking, Text } from 'react-native';
import { Building2, Check, Video } from 'lucide-react-native';
import {
  useAppointmentQuery,
  useLoadAppointment,
  useCancelAppointmentMutation,
  useRescheduleAppointmentMutation,
} from '@/api/appointments';
import { useDentistQuery } from '@/api/dentists';
import { usePatientQuery } from '@/api/patients';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Detail,
  ErrorState,
  Loading,
  Screen,
  TextLink,
} from '@/components/ui';
import { AppointmentFiles } from '@/components/patient-files';
import { CompletedVisitDocuments } from '@/components/care-document-downloads';
import { SlotPicker } from '@/components/slot-picker';
import {
  activeAppointment,
  addDays,
  formatDate,
  formatTime,
  paymentLabel,
  rupees,
  statusLabel,
} from '@/lib/patient';
import { errorMessage } from '@/api/errors';
import {
  CheckoutUnavailableError,
  checkoutUnavailableReason,
  openCheckout,
} from '@/lib/checkout';
import type { PatientScreenProps } from '@/navigation/types';
import { colors, ui } from '@/theme';
import { useVideoCall } from '@/video/video-call-provider';

export function AppointmentScreen({
  route,
  navigation,
}: PatientScreenProps<'Appointment'>) {
  const { appointmentId, justBooked } = route.params;
  const videoCall = useVideoCall();
  const {
    data: a,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useAppointmentQuery(appointmentId, {
    pollingInterval: 15000,
    refetchOnMountOrArgChange: true,
  });
  const { data: dentist } = useDentistQuery(a?.dentistId);
  const { data: me } = usePatientQuery();
  const loadAppointment = useLoadAppointment();
  const [cancel, { isLoading: cancelling }] = useCancelAppointmentMutation();
  const [paying, setPaying] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const clinic = dentist?.clinics?.find(c => c.id === a?.clinicId);
  const active = a ? activeAppointment(a) : false;
  const pending = ['pending', 'failed'].includes(a?.payment?.status ?? '');
  const checkoutProblem =
    a && active && pending ? checkoutUnavailableReason(a) : undefined;
  const canPay = active && pending && !checkoutProblem;
  useEffect(() => {
    setActionError(undefined);
  }, [appointmentId, a?.status, a?.payment?.status, a?.payment?.expiresAt]);
  function cancelAppointment() {
    Alert.alert(
      'Cancel this appointment?',
      cancellationPaymentMessage(a?.payment),
      [
        { text: 'Keep appointment', style: 'cancel' },
        {
          text: 'Cancel appointment',
          style: 'destructive',
          onPress: () => {
            void cancel(appointmentId).catch(err =>
              setActionError(errorMessage(err)),
            );
          },
        },
      ],
    );
  }
  async function pay() {
    if (!a) return;
    setPaying(true);
    setActionError(undefined);
    let checkoutStarted = false;
    try {
      // A capture, cancellation or expiry may have happened since the last poll.
      const latest = await loadAppointment(appointmentId);
      checkoutStarted = true;
      await openCheckout(latest, me);
      void refetch();
    } catch (err) {
      setActionError(
        err instanceof CheckoutUnavailableError
          ? err.message
          : errorMessage(
              err,
              checkoutStarted
                ? 'Payment was not confirmed. You can retry, or contact support if your account was debited.'
                : 'Could not refresh payment status. Please check your connection and try again.',
            ),
      );
    } finally {
      setPaying(false);
    }
  }
  return (
    <Screen
      title="Appointment"
      onBack={navigation.goBack}
      action={
        a?.status === 'booked' ? (
          <TextLink
            title="Reschedule"
            onPress={() => navigation.navigate('Reschedule', { appointmentId })}
          />
        ) : undefined
      }
      refreshing={isFetching}
      onRefresh={refetch}
      footer={
        a?.status === 'completed' ? (
          <Button
            title="View visit summary"
            onPress={() => navigation.navigate('Visit', { appointmentId })}
          />
        ) : canPay ? (
          <Button
            title={`Pay ${rupees(a?.payment?.amountPaise)}`}
            onPress={() => void pay()}
            loading={paying}
            disabled={cancelling || !!error}
          />
        ) : undefined
      }
    >
      {error ? (
        <ErrorState retry={refetch} />
      ) : isLoading || !a ? (
        <Loading />
      ) : (
        <>
          {justBooked && active ? (
            <Card
              style={{
                backgroundColor: pending ? colors.amberSoft : colors.greenSoft,
              }}
            >
              <Check color={pending ? colors.amber : colors.green} />
              <Text style={ui.heading}>
                {pending ? 'Complete your payment' : 'Appointment confirmed'}
              </Text>
              <Text style={ui.muted}>
                {pending
                  ? 'Complete payment within 15 minutes of booking to confirm your slot.'
                  : 'Your dentist will see the details you shared before your visit.'}
              </Text>
            </Card>
          ) : null}
          <Card>
            <Avatar name={a.dentistName} large />
            <Text style={ui.title}>{a.dentistName}</Text>
            <Text style={ui.muted}>{dentist?.qualification}</Text>
            <Badge
              title={statusLabel[a.status ?? ''] ?? 'Appointment'}
              tone={
                a.status === 'cancelled'
                  ? 'red'
                  : a.status === 'completed'
                  ? 'green'
                  : 'accent'
              }
            />
          </Card>
          <Card>
            <Detail
              label="When"
              value={`${formatDate(a.date)}, ${formatTime(a.time)}`}
            />
            <Detail
              label="Visit"
              value={
                a.type === 'video' ? 'Video consultation' : 'In-clinic visit'
              }
            />
            {a.type === 'clinic' ? (
              <Detail
                label="Clinic"
                value={clinic?.name ?? 'See your dentist’s clinic details'}
              />
            ) : null}
            <Detail label="Fee" value={rupees(a.payment?.amountPaise)} />
            <Detail
              label="Payment"
              value={
                a.payment?.collection
                  ? 'Paid at clinic'
                  : paymentLabel[a.payment?.status ?? ''] ?? '—'
              }
            />
            <ClinicPaymentDetails appointment={a} />
          </Card>
          {checkoutProblem ? <ErrorState message={checkoutProblem} /> : null}
          {a.payment?.status === 'refund_pending' ? (
            <Card>
              <Text style={ui.heading}>Your refund is processing</Text>
              <Text style={ui.muted}>
                Your appointment is cancelled. We’ll update this status when the
                payment provider confirms your refund.
              </Text>
            </Card>
          ) : a.payment?.status === 'refund_failed' ? (
            <Card>
              <Text style={ui.heading}>Your refund needs attention</Text>
              <Text style={ui.muted}>
                Your appointment is cancelled, but the refund has not been
                confirmed. Contact support with your appointment reference.
              </Text>
              <Button
                title="Contact support"
                variant="secondary"
                onPress={() => navigation.navigate('Help')}
              />
            </Card>
          ) : null}
          <AppointmentFiles appointmentId={appointmentId} />
          {a.status === 'completed' ? (
            <CompletedVisitDocuments appointmentId={appointmentId} />
          ) : null}
          <Card>
            <Text style={ui.heading}>What you told us</Text>
            <Detail label="Problem" value={a.concern} />
            <Detail label="Where" value={a.symptomArea} />
            <Detail label="Since" value={a.symptomSince} />
            {a.painScore != null ? (
              <Detail label="Pain" value={`${a.painScore}/10`} />
            ) : null}
            <Detail label="Swelling" value={a.swelling ? 'Yes' : 'No'} />
            {a.note ? <Detail label="Note" value={a.note} /> : null}
          </Card>
          {active && a.type === 'clinic' ? (
            <Card style={{ backgroundColor: colors.accentSoft }}>
              <Building2 size={23} color={colors.accent} />
              <Text style={ui.heading}>We’ll see you at the clinic</Text>
              <Text style={ui.muted}>
                Please arrive 10 minutes early.
                {clinic?.addressLine ? ` ${clinic.addressLine}` : ''}
              </Text>
              {clinic?.addressLine ? (
                <Button
                  title="Get directions"
                  variant="secondary"
                  onPress={() => {
                    void Linking.openURL(
                      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        `${clinic.name} ${clinic.addressLine}`,
                      )}`,
                    ).catch(() =>
                      setActionError('Couldn’t open maps on this device.'),
                    );
                  }}
                />
              ) : null}
            </Card>
          ) : null}
          {active && a.type === 'video' ? (
            <Card>
              <Video color={colors.accent} size={25} />
              <Text style={ui.heading}>Video consultation</Text>
              <Text style={ui.muted}>
                {a.payment?.status === 'paid'
                  ? 'Join from 10 minutes before your appointment. Your dentist will meet you in a private video room.'
                  : 'Complete your payment before joining the video consultation.'}
              </Text>
              <Button
                title="Open video consultation"
                disabled={a.payment?.status !== 'paid'}
                onPress={() => videoCall.open(appointmentId)}
              />
            </Card>
          ) : null}
          {actionError ? <ErrorState message={actionError} /> : null}
          {a.status === 'booked' ? (
            <Button
              title="Reschedule"
              variant="secondary"
              disabled={cancelling || paying}
              onPress={() =>
                navigation.navigate('Reschedule', { appointmentId })
              }
            />
          ) : null}
          {active ? (
            <Button
              title="Cancel appointment"
              variant="danger"
              loading={cancelling}
              disabled={paying}
              onPress={cancelAppointment}
            />
          ) : null}
          <Text style={ui.small}>Reference: {a.id}</Text>
        </>
      )}
    </Screen>
  );
}

export function RescheduleScreen({
  route,
  navigation,
}: PatientScreenProps<'Reschedule'>) {
  const { appointmentId } = route.params;
  const {
    data: a,
    error,
    isLoading,
    refetch,
  } = useAppointmentQuery(appointmentId);
  const [date, setDate] = useState(addDays(1));
  const [time, setTime] = useState('');
  const [message, setMessage] = useState<string>();
  const [reschedule, { isLoading: saving }] =
    useRescheduleAppointmentMutation();
  async function submit() {
    setMessage(undefined);
    try {
      await reschedule(appointmentId, date, time);
      navigation.goBack();
    } catch (err) {
      setMessage(errorMessage(err));
      setTime('');
    }
  }
  return (
    <Screen
      title="Reschedule"
      onBack={navigation.goBack}
      footer={
        <Button
          title="Confirm new time"
          disabled={!time || a?.status !== 'booked'}
          loading={saving}
          onPress={() => void submit()}
        />
      }
    >
      {error ? (
        <ErrorState retry={refetch} />
      ) : isLoading || !a ? (
        <Loading />
      ) : a.status !== 'booked' ? (
        <ErrorState message="This appointment can no longer be rescheduled." />
      ) : (
        <>
          <Card>
            <Detail label="Dentist" value={a.dentistName} />
            <Detail
              label="Currently"
              value={`${formatDate(a.date)}, ${formatTime(a.time)}`}
            />
          </Card>
          <SlotPicker
            dentistId={a.dentistId!}
            type={a.type!}
            clinicId={a.clinicId ?? undefined}
            date={date}
            time={time}
            onDate={setDate}
            onTime={setTime}
          />
          <Text style={ui.muted}>
            Your original payment carries over. There is no extra charge to
            change the time.
          </Text>
        </>
      )}
      {message ? <ErrorState message={message} /> : null}
    </Screen>
  );
}
