import type { VideoStatus } from '@/api/types';
export function videoStatusText(status?: VideoStatus): string {
  switch (status?.reason) {
    case 'ready':
      return 'Your video room is open. Join when you are ready.';
    case 'too_early':
      return 'Joining opens 10 minutes before your appointment.';
    case 'payment_required':
      return 'Complete payment from your appointment details before joining.';
    case 'session_ended':
      return 'Sign in again to join your consultation.';
    case 'dentist_unavailable':
      return 'Your dentist is unavailable. Please contact support.';
    case 'closed':
      return 'This video consultation is no longer available.';
    case 'not_video':
      return 'This is an in-clinic appointment.';
    default:
      return 'Video consultations are temporarily unavailable. Try again shortly.';
  }
}
