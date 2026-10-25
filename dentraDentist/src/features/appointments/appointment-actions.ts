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
      appointment.date === today,
    reschedule: appointment.status === 'booked',
    cancel: appointment.status === 'booked' || appointment.status === 'waiting',
  };
}
