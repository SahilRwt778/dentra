import type { Appointment } from '../../common/types/api';
import { dateKey } from '../../common/utils/date';

export function availableAppointmentActions(
  appointment: Appointment,
  today = dateKey(),
) {
  return {
    checkIn:
      appointment.status === 'booked' &&
      appointment.type === 'clinic' &&
      appointment.payment?.status !== 'coverage_revoked' &&
      (!appointment.followUpOf ||
        appointment.consultationCase?.status === 'active') &&
      appointment.date === today,
    reschedule:
      appointment.status === 'booked' &&
      (!appointment.followUpOf ||
        appointment.consultationCase?.status === 'active'),
    cancel: appointment.status === 'booked' || appointment.status === 'waiting',
  };
}
