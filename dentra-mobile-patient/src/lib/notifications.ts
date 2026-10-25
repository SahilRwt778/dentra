import type { Notification, PatientAppointmentNotification } from '@/api/types';

export function isPatientNotification(
  item: Notification,
): item is PatientAppointmentNotification {
  return (
    item.type !== 'appointment_booked' &&
    item.type !== 'dentist_onboarding_submitted'
  );
}

export function notificationTitle(item: PatientAppointmentNotification) {
  switch (item.type) {
    case 'booking_confirmed':
      return item.paymentRequired
        ? 'Booking received'
        : 'Appointment confirmed';
    case 'appointment_cancelled':
      return 'Appointment cancelled';
    case 'appointment_rescheduled':
      return 'Appointment rescheduled';
    case 'appointment_reminder':
      return 'Appointment reminder';
    case 'visit_summary_ready':
      return 'Visit summary ready';
  }
}

export function notificationMessage(item: PatientAppointmentNotification) {
  switch (item.type) {
    case 'booking_confirmed':
      return item.paymentRequired
        ? 'Your slot is reserved. Open the appointment to check or complete payment.'
        : 'Your appointment is booked. We look forward to seeing you.';
    case 'appointment_cancelled':
      return 'This appointment has been cancelled. Open it to view the details.';
    case 'appointment_rescheduled':
      return 'Your appointment has moved to the date and time shown below.';
    case 'appointment_reminder':
      return 'Your appointment starts within the next hour.';
    case 'visit_summary_ready':
      return 'Your completed visit summary and any signed prescription are ready.';
  }
}
