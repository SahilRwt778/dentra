import { useCallback } from 'react';
import {
  useGetAppointmentsQuery,
  useLazyGetAppointmentsQuery,
  useGetAppointmentsByAppointmentIdQuery,
  useLazyGetAppointmentsByAppointmentIdQuery,
  usePostAppointmentsMutation,
  usePostAppointmentsByAppointmentIdCancelMutation,
  usePostAppointmentsByAppointmentIdRescheduleMutation,
  useGetAppointmentsByAppointmentIdConsultationQuery,
  useLazyGetAppointmentsByAppointmentIdConsultationQuery,
} from './generated/patient-api';
import type { BookAppointment, QueryOptions } from './types';

export function useAppointmentsPageQuery(page = 1, options?: QueryOptions) {
  return useGetAppointmentsQuery({ page }, options);
}

export function useLoadAppointmentsPage() {
  const [load] = useLazyGetAppointmentsQuery();
  return useCallback((page: number) => load({ page }, false).unwrap(), [load]);
}

export function useAppointmentQuery(
  appointmentId: string,
  options?: QueryOptions,
) {
  return useGetAppointmentsByAppointmentIdQuery({ appointmentId }, options);
}

export function useLoadAppointment() {
  const [load] = useLazyGetAppointmentsByAppointmentIdQuery();
  return useCallback(
    (appointmentId: string) => load({ appointmentId }, false).unwrap(),
    [load],
  );
}

export function useBookAppointmentMutation() {
  const [send, state] = usePostAppointmentsMutation();
  const book = useCallback(
    (booking: BookAppointment) => send({ bookAppointment: booking }).unwrap(),
    [send],
  );
  return [book, state] as const;
}

export function useCancelAppointmentMutation() {
  const [send, state] = usePostAppointmentsByAppointmentIdCancelMutation();
  const cancel = useCallback(
    (appointmentId: string) => send({ appointmentId }).unwrap(),
    [send],
  );
  return [cancel, state] as const;
}

export function useRescheduleAppointmentMutation() {
  const [send, state] = usePostAppointmentsByAppointmentIdRescheduleMutation();
  const reschedule = useCallback(
    (appointmentId: string, date: string, time: string) =>
      send({ appointmentId, body: { date, time } }).unwrap(),
    [send],
  );
  return [reschedule, state] as const;
}

export function useConsultationQuery(
  appointmentId: string,
  options?: QueryOptions,
) {
  return useGetAppointmentsByAppointmentIdConsultationQuery(
    { appointmentId },
    options,
  );
}

export function useLoadConsultation() {
  const [load] = useLazyGetAppointmentsByAppointmentIdConsultationQuery();
  return useCallback(
    (appointmentId: string) => load({ appointmentId }, false).unwrap(),
    [load],
  );
}
