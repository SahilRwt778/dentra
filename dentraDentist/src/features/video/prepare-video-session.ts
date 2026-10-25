import axios from 'axios';
import { appointmentsApi } from '../../api/appointments.api';
import { videoApi } from '../../api/video.api';
import { videoStatusMessage } from './video-status';

export async function prepareVideoSession(
  appointmentId: string,
  signal: AbortSignal,
  assertCurrent: () => void,
) {
  const status = await videoApi.getStatus(appointmentId, signal);
  assertCurrent();
  if (!status.canJoin) throw new Error(videoStatusMessage(status));

  const appointment = await appointmentsApi.get(appointmentId, signal);
  assertCurrent();
  if (
    appointment.type !== 'video' ||
    !['booked', 'waiting', 'in_consult'].includes(appointment.status)
  )
    throw new Error(
      'This appointment is no longer available for a video consultation.',
    );

  if (appointment.status !== 'in_consult') {
    try {
      await appointmentsApi.start(appointmentId, signal);
    } catch (error) {
      // Another device may already have started the same visit.
      if (!axios.isAxiosError(error) || error.response?.status !== 409)
        throw error;
      assertCurrent();
      const current = await appointmentsApi.get(appointmentId, signal);
      if (current.status !== 'in_consult') throw error;
    }
  }
  assertCurrent();
  const credentials = await videoApi.join(appointmentId, signal);
  assertCurrent();
  if (
    credentials.role !== 'dentist' ||
    credentials.provider !== 'livekit' ||
    !credentials.serverUrl ||
    !credentials.token ||
    !credentials.identity ||
    !credentials.roomName
  )
    throw new Error('Could not open the dentist video room. Please try again.');
  return credentials;
}
