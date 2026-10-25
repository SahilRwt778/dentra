import { useEffect, useRef, useState } from 'react';
import {
  dentraApi,
  usePostAppointmentsByAppointmentIdClinicPaymentMutation,
  type Appointment,
  type ClinicCollectionMethod,
} from '@/api/generated-api';
import { useAppDispatch } from '@/store/hooks';
import { apiErrorMessage } from '@/lib/api-error';
import { canCollectClinicPayment } from '@/lib/clinic-payment';

export function useClinicPayment(appointment: Appointment, disabled: boolean) {
  const [method, setMethod] = useState<ClinicCollectionMethod | ''>('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [collect] = usePostAppointmentsByAppointmentIdClinicPaymentMutation();
  const dispatch = useAppDispatch();
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function selectMethod(value: ClinicCollectionMethod | '') {
    if (lock.current || disabled) return;
    if (value !== method) setRequestId(crypto.randomUUID());
    setMethod(value);
    setError(null);
    setNotice(null);
  }
  async function receive(result: Appointment) {
    if (mounted.current)
      await dispatch(
        dentraApi.util.upsertQueryData(
          'getAppointmentsByAppointmentId',
          { appointmentId: result.id! },
          result,
        ),
      );
  }
  async function record() {
    if (
      lock.current ||
      disabled ||
      !method ||
      !canCollectClinicPayment(appointment)
    )
      return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await receive(
        await collect({
          appointmentId: appointment.id!,
          collectClinicPayment: {
            requestId,
            amountPaise: appointment.payment!.amountPaise!,
            method,
          },
        }).unwrap(),
      );
      if (mounted.current) setNotice('Payment recorded.');
    } catch (failure) {
      const current = await dispatch(
        dentraApi.endpoints.getAppointmentsByAppointmentId.initiate(
          { appointmentId: appointment.id! },
          { forceRefetch: true, subscribe: false },
        ),
      )
        .unwrap()
        .catch(() => null);
      if (!mounted.current) return;
      if (current) await receive(current);
      if (!mounted.current) return;
      if (current?.payment?.collection)
        setNotice(
          current.payment.collection.id === requestId
            ? 'Payment recorded.'
            : 'Payment was already recorded. Review its receipt.',
        );
      else
        setError(
          apiErrorMessage(
            failure,
            'Could not record payment. Please try again.',
          ),
        );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return { method, selectMethod, busy, error, notice, record };
}
