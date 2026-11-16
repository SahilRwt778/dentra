import type { ConsultationCase, ConsultationCasePage } from '@dentra/call-core';
import { api } from './client';

export const consultationCasesApi = {
  async list(page: number, signal?: AbortSignal) {
    const { data } = await api.get<ConsultationCasePage>(
      '/consultation-cases',
      { params: { page }, signal },
    );
    return data;
  },
  async get(caseId: string, signal?: AbortSignal) {
    const { data } = await api.get<ConsultationCase>(
      `/consultation-cases/${caseId}`,
      { signal },
    );
    return data;
  },
};
