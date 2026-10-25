import type { VideoStatus } from '../../common/types/api';

export function videoStatusMessage(status?: VideoStatus): string {
  switch (status?.reason) {
    case 'ready':
      return 'The video room is open. Join when you are ready.';
    case 'too_early':
      return 'Joining opens 10 minutes before the appointment.';
    case 'payment_required':
      return 'The patient must complete payment before this video consultation can start.';
    case 'session_ended':
      return 'Sign in again to join this consultation.';
    case 'dentist_unavailable':
      return 'Your account is unavailable for video consultations. Contact the Dentra team.';
    case 'closed':
      return 'This video consultation is no longer available.';
    case 'not_video':
      return 'This appointment is an in-clinic visit.';
    default:
      return 'Video consultations are temporarily unavailable. Please try again shortly.';
  }
}
