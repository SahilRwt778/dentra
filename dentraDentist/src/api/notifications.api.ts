import { api } from './client';
import type {
  DentistNotification,
  NotificationPage,
} from '../common/types/api';

export const notificationsApi = {
  async list(cursor?: string, signal?: AbortSignal) {
    const { data } = await api.get<NotificationPage>('/notifications', {
      params: { cursor },
      signal,
    });
    return data;
  },
  async markRead(id: string) {
    const { data } = await api.patch<DentistNotification>(
      `/notifications/${id}/read`,
    );
    return data;
  },
  async markAllRead(through: string) {
    const { data } = await api.post<{ markedRead: number }>(
      '/notifications/read-all',
      { through },
    );
    return data;
  },
};
