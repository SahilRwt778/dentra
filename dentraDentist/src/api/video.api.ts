import { Platform } from 'react-native';
import { api } from './client';
import type { VideoSession, VideoStatus } from '../common/types/api';

export const videoApi = {
  async getStatus(appointmentId: string, signal?: AbortSignal) {
    const { data } = await api.get<VideoStatus>(
      `/appointments/${appointmentId}/video`,
      { signal, timeout: 8000 },
    );
    return data;
  },
  async join(appointmentId: string, signal?: AbortSignal) {
    const { data } = await api.post<VideoSession>(
      `/appointments/${appointmentId}/video/token`,
      { platform: Platform.OS },
      { signal },
    );
    return data;
  },
};
