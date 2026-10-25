import { api } from './client';
import type { PatientAllergies } from '../common/types/prescription';
import type { PatientRecord, PatientSummary } from '../common/types/patient';
import type {
  PatientDentalChart,
  ToothFinding,
} from '../common/types/dental-chart';

export const patientsApi = {
  async list(signal?: AbortSignal) {
    const { data } = await api.get<PatientSummary[]>('/dentists/me/patients', {
      signal,
    });
    return data;
  },
  async get(patientId: string, signal?: AbortSignal) {
    const { data } = await api.get<PatientRecord>(
      `/dentists/me/patients/${patientId}`,
      { signal },
    );
    return data;
  },
  async getAllergies(
    patientId: string,
    signal?: AbortSignal,
  ): Promise<PatientAllergies> {
    const { data } = await api.get<{ id: string; allergies: string | null }>(
      `/dentists/me/patients/${patientId}`,
      { signal },
    );
    return { patientId: data.id, allergies: data.allergies };
  },
  async getDentalChart(
    patientId: string,
    signal?: AbortSignal,
  ): Promise<PatientDentalChart> {
    const { data } = await api.get<{ id: string; chart: ToothFinding[] }>(
      `/dentists/me/patients/${patientId}`,
      { signal },
    );
    // Cache only the chart fields this screen needs, not the entire patient profile.
    return {
      patientId: data.id,
      teeth: data.chart.map(({ toothNumber, status }) => ({
        toothNumber,
        status,
      })),
    };
  },
};
