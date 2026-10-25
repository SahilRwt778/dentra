import {
  useGetAppointmentsByAppointmentIdVideoQuery,
  type VideoSession,
} from './generated/patient-api';
import { requestPrivate } from './private-request';

export function useVideoStatusQuery(appointmentId: string) {
  return useGetAppointmentsByAppointmentIdVideoQuery(
    { appointmentId },
    { pollingInterval: 5000, refetchOnMountOrArgChange: true },
  );
}

export function joinVideo(appointmentId: string, platform: 'android' | 'ios') {
  return requestPrivate<VideoSession>({
    url: `/appointments/${appointmentId}/video/token`,
    method: 'POST',
    body: { platform },
  });
}
