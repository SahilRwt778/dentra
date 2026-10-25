import { api } from './client';
import type {
  TimeOff,
  TimeOffInput,
  TimeOffPreview,
} from '../common/types/availability';

const path = '/dentists/me/time-off';
export const availabilityApi = {
  async list(signal?: AbortSignal) {
    const { data } = await api.get<TimeOff[]>(path, { signal });
    return data;
  },
  async preview(input: TimeOffInput, signal?: AbortSignal) {
    const { data } = await api.post<TimeOffPreview>(`${path}/preview`, input, {
      signal,
    });
    return data;
  },
  async create(
    input: TimeOffInput & { requestId: string },
    signal?: AbortSignal,
  ) {
    const { data } = await api.post<TimeOff>(path, input, { signal });
    return data;
  },
  async remove(id: string, signal?: AbortSignal) {
    await api.delete(`${path}/${id}`, { signal });
    return null;
  },
};
