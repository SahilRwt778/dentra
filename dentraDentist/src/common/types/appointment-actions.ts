import type { Appointment } from './api';

export type ScheduleDay = { date: string; appointments: Appointment[] };

export type AppointmentSlotRequest = {
  dentistId: string;
  date: string;
  type: 'clinic' | 'video';
  clinicId?: string;
};
export type AppointmentSlots = { date: string; slots: string[] };

export type RescheduleAppointment = {
  date: string;
  time: string;
  expectedDate: string;
  expectedTime: string;
};
