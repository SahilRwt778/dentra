import type { VideoStatus } from '@/api/generated-api';

export function videoStatusText(status?: VideoStatus) {
  switch (status?.reason) {
    case 'ready':
      return 'The patient joins from the Dentra app. Join when you are ready.';
    case 'too_early':
      return 'Joining opens 10 minutes before the appointment.';
    case 'payment_required':
      return 'The patient must complete payment before joining.';
    case 'session_ended':
      return 'Sign in again to join the consultation.';
    case 'dentist_unavailable':
      return 'Your account is unavailable for video consultations.';
    case 'closed':
      return 'This video consultation is no longer available.';
    default:
      return 'Video consultations are temporarily unavailable.';
  }
}
