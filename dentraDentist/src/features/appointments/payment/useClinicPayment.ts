import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import type { Appointment } from '../../../common/types/api';
import type {
  ClinicCollectionMethod,
  CollectClinicPayment,
} from '../../../common/types/clinic-payment';
import { errorMessage } from '../../../common/utils/api-error';
import { createRequestId } from '../../../common/utils/request-id';
import { money } from '../../../common/utils/date';
import { useMounted } from '../../../common/hooks/useMounted';
import { appointmentsApi } from '../../../api/appointments.api';
import {
  dentraApi,
  useCollectClinicPaymentMutation,
} from '../../../store/dentraApi';
import { useAppStore } from '../../../store/hooks';
import {
  canCollectClinicPayment,
  collectionMethodLabel,
} from './clinic-payment';

export function useClinicPayment(appointment: Appointment, disabled: boolean) {
  const [method, setMethod] = useState<ClinicCollectionMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [collect] = useCollectClinicPaymentMutation();
  const requestId = useRef(createRequestId());
  const lock = useRef(false);
  const confirming = useRef(false);
  const latest = useRef({ appointment, disabled });
  latest.current = { appointment, disabled };
  const mounted = useMounted();
  const store = useAppStore();
  usePreventRemove(busy, () =>
    Alert.alert('Recording payment', 'Please wait for the request to finish.'),
  );

  async function receive(result: Appointment) {
    if (mounted.current)
      await store.dispatch(
        dentraApi.util.upsertQueryData('getAppointment', result.id, result),
      );
  }
  function selectMethod(value: ClinicCollectionMethod) {
    if (lock.current || confirming.current || latest.current.disabled) return;
    if (value !== method) requestId.current = createRequestId();
    setMethod(value);
    setError(null);
    setNotice(null);
  }
  async function record(details: CollectClinicPayment) {
    confirming.current = false;
    const current = latest.current;
    if (
      lock.current ||
      !mounted.current ||
      current.disabled ||
      !canCollectClinicPayment(current.appointment)
    )
      return;
    if (details.amountPaise !== current.appointment.payment?.amountPaise) {
      setError(
        'This appointment changed. Review its current fee before recording payment.',
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await receive(
        await collect({
          appointmentId: current.appointment.id,
          details,
        }).unwrap(),
      );
      if (mounted.current) setNotice('Payment recorded.');
    } catch (failure) {
      // A timeout may follow a committed receipt, or another device may have collected it.
      const refreshed = await appointmentsApi
        .get(current.appointment.id)
        .catch(() => null);
      if (!mounted.current) return;
      if (refreshed) await receive(refreshed);
      if (!mounted.current) return;
      if (refreshed?.payment?.collection) {
        setNotice(
          refreshed.payment.collection.id === details.requestId
            ? 'Payment recorded.'
            : 'Payment was already recorded. Review the receipt below.',
        );
      } else setError(errorMessage(failure));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function confirm() {
    const current = latest.current;
    if (
      lock.current ||
      confirming.current ||
      current.disabled ||
      !method ||
      !canCollectClinicPayment(current.appointment)
    )
      return;
    confirming.current = true;
    const details = {
      requestId: requestId.current,
      amountPaise: current.appointment.payment!.amountPaise,
      method,
    };
    Alert.alert(
      'Record payment received?',
      `${current.appointment.patientName}\n${money(
        details.amountPaise,
      )} received by ${collectionMethodLabel(
        method,
      )} at the clinic.\n\nConfirm only after receiving the full consultation fee.`,
      [
        {
          text: 'Go back',
          style: 'cancel',
          onPress: () => {
            confirming.current = false;
          },
        },
        { text: 'Confirm received', onPress: () => record(details) },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          confirming.current = false;
        },
      },
    );
  }
  return { method, selectMethod, busy, error, notice, confirm };
}
