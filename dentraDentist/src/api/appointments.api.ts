import { api } from './client';
import { addDays } from '../common/utils/date';
import type { Appointment, Page } from '../common/types/api';
import type {
  AppointmentSlotRequest,
  AppointmentSlots,
  ScheduleDay,
  RescheduleAppointment,
} from '../common/types/appointment-actions';

export const appointmentsApi = {
  async checkIn(id: string, signal?: AbortSignal) {
    const { data } = await api.post<Appointment>(
      `/appointments/${id}/check-in`,
      {},
      { signal },
    );
    return data;
  },
  async cancel(id: string, signal?: AbortSignal) {
    const { data } = await api.post<Appointment>(
      `/appointments/${id}/cancel`,
      {},
      { signal },
    );
    return data;
  },
  async reschedule(
    id: string,
    details: RescheduleAppointment,
    signal?: AbortSignal,
  ) {
    const { data } = await api.post<Appointment>(
      `/appointments/${id}/reschedule`,
      details,
      { signal },
    );
    return data;
  },
  async slots(
    { dentistId, ...params }: AppointmentSlotRequest,
    signal?: AbortSignal,
  ) {
    const { data } = await api.get<AppointmentSlots>(
      `/dentists/${dentistId}/slots`,
      { params, signal },
    );
    return data;
  },
  async start(id: string, signal?: AbortSignal) {
    const { data } = await api.post<Appointment>(
      `/appointments/${id}/start`,
      undefined,
      { signal },
    );
    return data;
  },
  async list(date: string, page = 1, signal?: AbortSignal) {
    const { data } = await api.get<Page<Appointment>>('/appointments', {
      params: { date, page },
      signal,
    });
    return data;
  },
  async week(startDate: string, signal?: AbortSignal): Promise<ScheduleDay[]> {
    const dates = Array.from({ length: 7 }, (_, index) =>
      addDays(startDate, index),
    );
    return Promise.all(
      dates.map(async date => ({
        date,
        appointments: await appointmentsApi.listDay(date, signal),
      })),
    );
  },
  /** Day totals and chronological rows need every page. */
  async listDay(date: string, signal?: AbortSignal) {
    const items: Appointment[] = [];
    let page = 1;
    while (true) {
      const result = await appointmentsApi.list(date, page, signal);
      items.push(...result.items);
      if (result.nextPage === null) {
        return [...new Map(items.map(item => [item.id, item])).values()];
      }
      if (result.nextPage <= page)
        throw new Error('Could not load the complete day. Please refresh.');
      page = result.nextPage;
    }
  },
  async get(id: string, signal?: AbortSignal) {
    const { data } = await api.get<Appointment>(`/appointments/${id}`, {
      signal,
    });
    return data;
  },
};
