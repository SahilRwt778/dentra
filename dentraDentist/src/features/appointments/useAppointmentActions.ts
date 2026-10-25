import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import type { Appointment } from '../../common/types/api';
import { appointmentsApi } from '../../api/appointments.api';
import { useMounted } from '../../common/hooks/useMounted';
import { errorMessage } from '../../common/utils/api-error';
import { formatDate, formatTime } from '../../common/utils/date';
import {
  dentraApi,
  useCancelAppointmentMutation,
  useCheckInAppointmentMutation,
} from '../../store/dentraApi';
import { useAppStore } from '../../store/hooks';
import { callClosed } from '../../store/videoSlice';
import { availableAppointmentActions } from './appointment-actions';

type Action = 'checkIn' | 'cancel';

export function useAppointmentActions(
  appointment: Appointment,
  disabled: boolean,
) {
  const latest = useRef({ appointment, disabled });
  latest.current = { appointment, disabled };
  const [operation, setOperation] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checkIn, checkingIn] = useCheckInAppointmentMutation();
  const [cancel, cancelling] = useCancelAppointmentMutation();
  const lock = useRef(false);
  const confirming = useRef(false);
  const mounted = useMounted();
  const store = useAppStore();
  usePreventRemove(!!operation, () =>
    Alert.alert(
      'Updating appointment',
      'Please wait for the request to finish.',
    ),
  );

  async function receive(result: Appointment) {
    if (!mounted.current) return;
    await store.dispatch(
      dentraApi.util.upsertQueryData('getAppointment', result.id, result),
    );
    if (
      result.status === 'cancelled' &&
      store.getState().video.call?.appointmentId === result.id
    )
      store.dispatch(callClosed());
  }

  async function perform(action: Action, confirmed?: Appointment) {
    confirming.current = false;
    const current = latest.current;
    if (
      lock.current ||
      current.disabled ||
      !availableAppointmentActions(current.appointment)[action]
    )
      return;
    lock.current = true;
    setOperation(action);
    setError(null);
    setNotice(null);
    try {
      if (action === 'cancel' && confirmed) {
        // Re-read before cancelling so a changed schedule/status is shown for a new confirmation.
        const refreshed = await appointmentsApi.get(confirmed.id);
        if (!mounted.current) return;
        await receive(refreshed);
        if (!mounted.current) return;
        if (refreshed.status === 'cancelled') {
          setNotice('This appointment is cancelled.');
          return;
        }
        if (
          refreshed.date !== confirmed.date ||
          refreshed.time !== confirmed.time ||
          refreshed.status !== confirmed.status ||
          refreshed.payment?.status !== confirmed.payment?.status ||
          refreshed.payment?.collection?.id !==
            confirmed.payment?.collection?.id
        ) {
          setError(
            'This appointment changed. Review its latest details before cancelling.',
          );
          return;
        }
      }
      const result = await (action === 'checkIn'
        ? checkIn(current.appointment.id)
        : cancel(current.appointment.id)
      ).unwrap();
      if (!mounted.current) return;
      await receive(result);
      if (!mounted.current) return;
      setNotice(
        action === 'checkIn'
          ? 'Patient marked as arrived.'
          : 'Appointment cancelled.',
      );
    } catch (failure) {
      // A lost response may follow a committed action. Read the status before showing a retry.
      const refreshed = await appointmentsApi
        .get(current.appointment.id)
        .catch(() => null);
      if (!mounted.current) return;
      if (refreshed) await receive(refreshed);
      if (!mounted.current) return;
      const applied =
        action === 'cancel'
          ? refreshed?.status === 'cancelled'
          : refreshed?.status === 'waiting' ||
            refreshed?.status === 'in_consult';
      if (applied)
        setNotice(
          action === 'cancel'
            ? 'Appointment cancelled.'
            : 'The patient has already arrived.',
        );
      else setError(errorMessage(failure));
    } finally {
      lock.current = false;
      if (mounted.current) setOperation(null);
      checkingIn.reset();
      cancelling.reset();
    }
  }

  function requestCancellation() {
    const current = latest.current;
    if (
      lock.current ||
      confirming.current ||
      current.disabled ||
      !availableAppointmentActions(current.appointment).cancel
    )
      return;
    confirming.current = true;
    const snapshot = current.appointment;
    const refundNote =
      snapshot.payment?.status === 'paid' &&
      snapshot.payment.method === 'pay_at_clinic'
        ? 'Any refund for the payment collected at the clinic must be arranged directly with the clinic.'
        : 'Captured online payments follow the existing refund process.';
    Alert.alert(
      'Cancel appointment?',
      `${snapshot.patientName} · ${formatDate(snapshot.date)} · ${formatTime(
        snapshot.time,
      )}\n\nThe slot will be released and the patient notified. ${refundNote}`,
      [
        {
          text: 'Keep appointment',
          style: 'cancel',
          onPress: () => {
            confirming.current = false;
          },
        },
        {
          text: 'Cancel appointment',
          style: 'destructive',
          onPress: () => perform('cancel', snapshot),
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          confirming.current = false;
        },
      },
    );
  }
  return {
    operation,
    error,
    notice,
    checkIn: () => perform('checkIn'),
    requestCancellation,
  };
}
