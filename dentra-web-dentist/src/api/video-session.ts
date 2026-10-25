import type { VideoSession } from './generated-api';
import { requestPrivate } from './private-request';

export function joinVideo(appointmentId: string) {
  return requestPrivate<VideoSession>({
    url: `/appointments/${appointmentId}/video/token`,
    method: 'POST',
    body: { platform: 'web' },
  });
}
