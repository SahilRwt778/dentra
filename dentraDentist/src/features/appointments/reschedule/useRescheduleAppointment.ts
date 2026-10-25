import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useIsFocused, usePreventRemove } from '@react-navigation/native';
import type { Appointment } from '../../../common/types/api';
import { dateKey } from '../../../common/utils/date';
import { errorMessage } from '../../../common/utils/api-error';
import { useMounted } from '../../../common/hooks/useMounted';
import { useForegroundRefresh } from '../../../common/hooks/useForegroundRefresh';
import { appointmentsApi } from '../../../api/appointments.api';
import {
  dentraApi,
  useGetAppointmentSlotsQuery,
  useRescheduleAppointmentMutation,
} from '../../../store/dentraApi';
import { useAppDispatch } from '../../../store/hooks';

function initialDay(appointment: Appointment) {
  return appointment.date < dateKey() ? dateKey() : appointment.date;
}

export function useRescheduleAppointment(
  appointment: Appointment,
  loadError: string | null,
) {
  const [original, setOriginal] = useState({
    date: appointment.date,
    time: appointment.time,
  });
  const [date, setDate] = useState(() => initialDay(appointment));
  const [time, setTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Appointment | null>(null);
  const [reschedule, mutation] = useRescheduleAppointmentMutation();
  const dispatch = useAppDispatch();
  const mounted = useMounted();
  const lock = useRef(false);
  const focused = useIsFocused();
  const booked = appointment.status === 'booked';
  const ready =
    !!appointment.dentistId &&
    (appointment.type === 'video' || !!appointment.clinicId);
  const changed =
    appointment.date !== original.date || appointment.time !== original.time;
  const slots = useGetAppointmentSlotsQuery(
    {
      dentistId: appointment.dentistId ?? '',
      type: appointment.type,
      clinicId:
        appointment.type === 'clinic'
          ? appointment.clinicId ?? undefined
          : undefined,
      date,
    },
    { skip: !ready || !booked || !!saved },
  );
  useForegroundRefresh(
    slots.refetch,
    focused && ready && booked && !saved,
    15000,
  );
  usePreventRemove(busy && !saved, () =>
    Alert.alert(
      'Updating appointment',
      'Please wait for the new time to be confirmed.',
    ),
  );

  useEffect(() => {
    if (busy || saved || !time || !slots.currentData || slots.error) return;
    if (!slots.currentData.slots.includes(time)) {
      setTime('');
      setError(
        'The selected time is no longer available. Choose another time.',
      );
    }
  }, [busy, saved, time, slots.currentData, slots.error]);

  const validTime =
    !!time &&
    slots.currentData?.date === date &&
    slots.currentData.slots.includes(time);
  const canSave =
    booked &&
    ready &&
    !changed &&
    !loadError &&
    !slots.error &&
    !slots.isFetching &&
    validTime &&
    !saved;

  function selectDate(value: string | null) {
    if (!value || lock.current || saved) return;
    setDate(value);
    setTime('');
    setError(null);
  }
  function selectTime(value: string) {
    if (
      lock.current ||
      slots.isFetching ||
      slots.error ||
      saved ||
      !slots.currentData?.slots.includes(value)
    )
      return;
    setTime(value);
    setError(null);
  }
  function reviewUpdatedTime() {
    if (lock.current) return;
    setOriginal({ date: appointment.date, time: appointment.time });
    setDate(initialDay(appointment));
    setTime('');
    setError(null);
  }
  async function receive(result: Appointment) {
    if (!mounted.current) return;
    await dispatch(
      dentraApi.util.upsertQueryData('getAppointment', result.id, result),
    );
    if (mounted.current) setSaved(result);
  }
  async function confirm() {
    if (lock.current || !canSave) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const details = {
      date,
      time,
      expectedDate: original.date,
      expectedTime: original.time,
    };
    try {
      await receive(
        await reschedule({ appointmentId: appointment.id, details }).unwrap(),
      );
    } catch (failure) {
      const latest = await appointmentsApi
        .get(appointment.id)
        .catch(() => null);
      if (!mounted.current) return;
      if (latest)
        await dispatch(
          dentraApi.util.upsertQueryData('getAppointment', latest.id, latest),
        );
      if (!mounted.current) return;
      if (
        latest?.status === 'booked' &&
        latest.date === details.date &&
        latest.time === details.time
      ) {
        await receive(latest);
      } else {
        setError(errorMessage(failure));
        if ([400, 409].includes((failure as { status?: number }).status ?? 0))
          setTime('');
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
      mutation.reset();
    }
  }
  return {
    date,
    time,
    selectDate,
    selectTime,
    confirm,
    reviewUpdatedTime,
    busy,
    error,
    saved,
    changed,
    ready,
    booked,
    canSave,
    slots: slots.currentData,
    loadingSlots: slots.isFetching,
    slotsError: slots.error ? errorMessage(slots.error) : null,
    reloadSlots: slots.refetch,
  };
}
