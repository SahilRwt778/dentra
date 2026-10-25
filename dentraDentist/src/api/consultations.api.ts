import { api } from './client';
import type { ClinicalNote, Consultation } from '../common/types/consultation';
import type { ToothFinding } from '../common/types/dental-chart';
import type { TreatmentPlan } from '../common/types/treatment-plan';
import type { Appointment } from '../common/types/api';

export const consultationsApi = {
  async complete(appointmentId: string, signal?: AbortSignal) {
    const { data } = await api.post<Appointment>(
      `/appointments/${appointmentId}/consultation/complete`,
      {},
      { signal },
    );
    return data;
  },
  async savePlan(
    appointmentId: string,
    changes: Partial<TreatmentPlan>,
    signal?: AbortSignal,
  ) {
    const { data } = await api.put<Consultation>(
      `/appointments/${appointmentId}/consultation`,
      changes,
      { signal },
    );
    return data;
  },
  async get(appointmentId: string, signal?: AbortSignal) {
    const { data } = await api.get<Consultation>(
      `/appointments/${appointmentId}/consultation`,
      { signal },
    );
    return data;
  },
  async saveNote(
    appointmentId: string,
    changes: Partial<ClinicalNote>,
    signal?: AbortSignal,
  ) {
    // This endpoint also accepts charts and medicines. Send only changed note fields.
    const { data } = await api.put<Consultation>(
      `/appointments/${appointmentId}/consultation`,
      changes,
      { signal },
    );
    return data;
  },
  async saveChart(
    appointmentId: string,
    changes: ToothFinding[],
    signal?: AbortSignal,
  ) {
    const { data } = await api.put<Consultation>(
      `/appointments/${appointmentId}/consultation`,
      { chart: changes },
      { signal },
    );
    return data;
  },
};
